#include "video_reader.h"
using namespace std;

#include <cmath>
#include <csignal>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <chrono>

// FFmpeg Headers
extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libswscale/swscale.h>
#include <libavutil/imgutils.h>
}

#include <onnxruntime_cxx_api.h>

std::atomic<bool> VideoReader::cancelled(false);


VideoReader::VideoReader(const std::string& file_path) : file_path(file_path) {
    setCancelled(false);
    signal(SIGTERM, VideoReader::signalHandler);
    signal(SIGINT, VideoReader::signalHandler);
    last_fps_report_time = std::chrono::high_resolution_clock::now();
}

VideoReader::~VideoReader() {
    if (format_ctx) {
        avformat_close_input(&format_ctx);
    }
    if (codec_ctx) {
        avcodec_free_context(&codec_ctx);
    }
    if (frame) {
        av_frame_free(&frame);
    }
    if (file) {
      fclose(file);
    }
    if (parser) {
      av_parser_close(parser);
    }
}

void VideoReader::signalHandler(int signum) {
    std::cout << "Received signal " << signum << ". Terminating gracefully..." << std::endl;
    setCancelled(true);
}


bool VideoReader::Open() {
    if (avformat_open_input(&format_ctx, file_path.c_str(), nullptr, nullptr) < 0) {
        return false;
    }

    if (avformat_find_stream_info(format_ctx, nullptr) < 0) {
        return false;
    }

    for (uint32_t i = 0; i < format_ctx->nb_streams; i++) {
        if (format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            video_stream_index = i;
            break;
        }
    }

    if (video_stream_index == -1) {
        return false;
    }

    AVCodecParameters* codec_params = format_ctx->streams[video_stream_index]->codecpar;
    const AVCodec* codec = avcodec_find_decoder(codec_params->codec_id);
    if (!codec) {
        return false;
    }

    codec_ctx = avcodec_alloc_context3(codec);
    if (!codec_ctx) {
        return false;
    }

    if (avcodec_parameters_to_context(codec_ctx, codec_params) < 0) {
        return false;
    }

    if (avcodec_open2(codec_ctx, codec, nullptr) < 0) {
        return false;
    }

    parser = av_parser_init(codec->id);
    if (!parser) {
        return false;
    }

    frame = av_frame_alloc();
    if (!frame) {
      return false;
    }

    file = fopen(file_path.c_str(), "rb");
    if (!file) {
        return false;
    }
    return true;
  }

double VideoReader::getFrameRate() {
    if (video_stream_index == -1) return 0;
    return av_q2d(format_ctx->streams[video_stream_index]->r_frame_rate);
}

double VideoReader::getHeight() {
    if (video_stream_index == -1) return 0;
    return format_ctx->streams[video_stream_index]->codecpar->height;
}

double VideoReader::getWidth() {
    if (video_stream_index == -1) return 0;
    return format_ctx->streams[video_stream_index]->codecpar->width;
}

double VideoReader::getNumFrames() {
    if (video_stream_index == -1) return 0;
    return format_ctx->streams[video_stream_index]->nb_frames;
}

std::string VideoReader::getCodecName() {
    if (video_stream_index == -1) return "unknown";
    const AVCodec* codec = avcodec_find_decoder(
        format_ctx->streams[video_stream_index]->codecpar->codec_id);
    return codec ? codec->name : "unknown";
}

std::string VideoReader::getPixelFormat() {
    if (!codec_ctx) return "unknown";
    const char* name = av_get_pix_fmt_name(codec_ctx->pix_fmt);
    return name ? name : "unknown";
}

std::string VideoReader::getFormatName() {
    return format_ctx->iformat->name;
}

double VideoReader::getBitRate() {
    return format_ctx->bit_rate;
}

std::vector<uint8_t>& VideoReader::ReadNextFrame(std::vector<uint8_t>& out_frame_data) {
    AVPacket packet;
    int response;

    while (av_read_frame(format_ctx, &packet) >= 0) {
        if (packet.stream_index == video_stream_index) {
            response = avcodec_send_packet(codec_ctx, &packet);
            if (response < 0) {
                av_packet_unref(&packet);
                finished = true;
                return out_frame_data;
            }

            response = avcodec_receive_frame(codec_ctx, frame);
            if (response == AVERROR(EAGAIN) || response == AVERROR_EOF) {
                av_packet_unref(&packet);
                continue;
            } else if (response < 0) {
                av_packet_unref(&packet);
                finished = true;
                return out_frame_data;
            }

            // Update frame counter and report FPS
            frame_counter++;
            if (frame_counter % FPS_REPORT_INTERVAL == 0) {
                auto current_time = std::chrono::high_resolution_clock::now();
                auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(current_time - last_fps_report_time).count();
                double current_fps = (FPS_REPORT_INTERVAL * 1000.0) / elapsed;  // Convert to frames per second
                fprintf(stderr, "Processing frame %lld, Measured FPS: %.2f\n", frame_counter, current_fps);
                last_fps_report_time = current_time;
            }

            // TODO get cache sws context?
            SwsContext* sws_ctx = sws_getContext(
                frame->width, frame->height, codec_ctx->pix_fmt,
                48, 27, AV_PIX_FMT_RGB24,
                SWS_BICUBIC, nullptr, nullptr, nullptr
            );

            AVFrame* frame2 = av_frame_alloc();
            int num_bytes = av_image_get_buffer_size(AV_PIX_FMT_RGB24, 48, 27, 1);
            uint8_t* frame2_buffer = (uint8_t*)av_malloc(num_bytes);

            av_image_fill_arrays(frame2->data, frame2->linesize, frame2_buffer, AV_PIX_FMT_RGB24, 48, 27, 1);
            sws_scale(sws_ctx, frame->data, frame->linesize, 0, frame->height, frame2->data, frame2->linesize);

            for (int y = 0; y < 27; ++y) {
                uint8_t* row_ptr = frame2->data[0] + y * frame2->linesize[0];
                out_frame_data.insert(out_frame_data.end(), row_ptr, row_ptr + (48 * 3)); // 48 pixels * 3 bytes (RGB)
            }

            av_free(frame2_buffer);
            av_frame_free(&frame2);
            sws_freeContext(sws_ctx);
            av_packet_unref(&packet);
            finished = false;
            return out_frame_data;
        }
        av_packet_unref(&packet);
    }

    finished = true;
    return out_frame_data;
}

bool VideoReader::Done() const {
    return finished;
}


std::vector<std::vector<int>> VideoReader::DetectShots(const std::string& onnx_model_path) {
    std::vector<std::vector<int>> shots;
    std::vector<float> allPredictions;

    finished = false;
    cancelled = false;

    try {
        // ONNX Runtime setup
        Ort::Env env(ORT_LOGGING_LEVEL_WARNING, "shot_detection");
        Ort::SessionOptions session_options;
        // session_options.SetIntraOpNumThreads(1);
        #ifdef _WIN32
            std::wstring wide_path(onnx_model_path.begin(), onnx_model_path.end());
            Ort::Session session(env, wide_path.c_str(), session_options);
        #else
            Ort::Session session(env, onnx_model_path.c_str(), session_options);
        #endif

        // Inference parameters
        const int inputWidth = 48;
        const int inputHeight = 27;
        const int inputChannels = 3;
        const int sequenceLength = 100;
        const int stepSize = 50;
        const int paddingStart = 25;

        // Sliding window management
        std::vector<std::vector<uint8_t>> frameWindow;
        unsigned long frameCounter = 1;

        // Initial padding setup
        std::vector<uint8_t> frameData;
        ReadNextFrame(frameData);
        for (int i = 0; i <= paddingStart; ++i) {
            frameWindow.push_back(frameData);
        }

        // Process video in chunks
        while (!Done() && !isCancelled()) {
            // Collect frames for the current window
            while(frameWindow.size() < sequenceLength && !Done()) {
                std::vector<uint8_t> frameData;
                ReadNextFrame(frameData);
                frameCounter++;
                if (!frameData.empty()) {
                    frameWindow.push_back(frameData);
                }
            }

            // Add end padding if we're at the end of the video
            while(frameWindow.size() < sequenceLength && Done()) {
                frameWindow.push_back(frameWindow.back());
            }

            // Process current window if large enough
            if (frameWindow.size() >= sequenceLength) {
                // Prepare input tensor
                std::vector<float> inputData;
                inputData.reserve(sequenceLength * inputWidth * inputHeight * inputChannels);

                for (size_t i = 0; i < sequenceLength; ++i) {
                    for (size_t j = 0; j < inputWidth * inputHeight * inputChannels; ++j) {
                        inputData.push_back(frameWindow[i][j]);
                    }
                }

                // Create ONNX tensor
                std::vector<int64_t> inputShape = {1, 100, 27, 48, 3};
                Ort::MemoryInfo memoryInfo = Ort::MemoryInfo::CreateCpu(
                    OrtArenaAllocator, OrtMemTypeDefault);
                Ort::Value inputTensor = Ort::Value::CreateTensor<float>(
                    memoryInfo, inputData.data(), inputData.size(), inputShape.data(), inputShape.size());

                // Prepare input feeds
                std::vector<const char*> inputNames = {"input"};
                std::vector<const char*> outputNames = {"534"};

                // Run inference
                auto outputTensors = session.Run(Ort::RunOptions{nullptr},
                                                inputNames.data(), &inputTensor, 1,
                                                outputNames.data(), 1);

                // Extract predictions (25 to 75 indices for the current window)
                float* rawResult = outputTensors[0].GetTensorMutableData<float>();
                std::vector<float> windowPredictions(rawResult + 25, rawResult + 75);

                // Append to overall predictions
                allPredictions.insert(allPredictions.end(),
                                    windowPredictions.begin(),
                                    windowPredictions.end());

                // Slide the window
                frameWindow.erase(frameWindow.begin(), frameWindow.begin() + stepSize);
            }
        }

        // Convert predictions to shot boundaries
        std::vector<int> binaryPredictions;
        for (size_t i=0; i <= frameCounter; i++) {
            binaryPredictions.push_back(allPredictions[i] > 0.5 ? 1 : 0);
        }

        // Find shot boundaries
        int start = 0;
        int prevState = 0;
        for (size_t i = 0; i < binaryPredictions.size(); ++i) {
            int currState = binaryPredictions[i];

            if (prevState == 1 && currState == 0) {
                start = i;
            }

            if (prevState == 0 && currState == 1 && i != 0) {
                shots.push_back({start, static_cast<int>(i)});
            }

            prevState = currState;
        }

        // Handle last shot if needed
        if (prevState == 0) {
            shots.push_back({start, static_cast<int>(binaryPredictions.size() - 1)});
        }

        // If no shots detected, return full video as a single shot
        if (shots.empty()) {
            shots.push_back({0, static_cast<int>(binaryPredictions.size() - 1)});
        }

    } catch (const Ort::Exception& exception) {
        std::cerr << "ONNX Runtime error: " << exception.what() << std::endl;
    }

    return shots;
}

int VideoReader::generateScreenshot(const std::string& directory, int frame_num) {
    AVPacket packet;
    int response;
    AVRational fr;
    AVRational tb;
    int frame_num_jump;
    int64_t target;
    int64_t target_jump;
    bool has_prev = false;
    AVFrame* prevframe = av_frame_alloc();
    int64_t ts;

    frame_num_jump = frame_num - 100;
    if (frame_num_jump < 0) {
        frame_num_jump = 0;
    }

    fr = format_ctx->streams[video_stream_index]->avg_frame_rate;
    tb = format_ctx->streams[video_stream_index]->time_base;

    target = av_rescale_q(frame_num, av_inv_q(fr), tb);
    target_jump = av_rescale_q(frame_num_jump, av_inv_q(fr), tb);

    fprintf(stderr, "Seeking to frame %d (target ts: %lld)\n", frame_num, (long long)target);

    response = av_seek_frame(format_ctx, video_stream_index,
                             target_jump, AVSEEK_FLAG_BACKWARD);
    if (response < 0)
        return -1;

    avcodec_flush_buffers(codec_ctx);

    while (av_read_frame(format_ctx, &packet) >= 0) {
        if (packet.stream_index == video_stream_index) {
            if (avcodec_send_packet(codec_ctx, &packet) == 0) {
                while (avcodec_receive_frame(codec_ctx, frame) == 0) {
                    ts = frame->best_effort_timestamp;

                    if (ts > target && has_prev) {
                        // Use previous frame if we are passed the timestamp
                        av_frame_unref(frame);
                        av_frame_ref(frame, prevframe);
                    }
                    if (ts >= target) {
                        fprintf(stderr, "Reached target ts %lld\n", (long long)ts);

                        int ret = saveFrame(directory, frame_num);
                        av_packet_unref(&packet);
                        av_frame_free(&prevframe);
                        return ret;
                    }

                    // Store copy as previous frame
                    av_frame_unref(prevframe);
                    av_frame_ref(prevframe, frame);
                    has_prev = true;
                }
            }
        }

        av_packet_unref(&packet);
    }

    av_frame_free(&prevframe);
    return -1;
}

int VideoReader::saveFrame(const std::string& directory, int frame_num) {
    std::ostringstream path;
    path << directory << '/' << std::setw(8) << std::setfill('0') << frame_num << ".jpg";

    if (saveFrameAsJpeg(codec_ctx->pix_fmt, frame, path.str()) < 0) {
        return -1;
    }

    // Generate a mini thumbnail
    AVPixelFormat scaled_pix_fmt = AV_PIX_FMT_YUV420P;
    SwsContext* sws_ctx = sws_getContext(
        frame->width, frame->height, static_cast<AVPixelFormat>(frame->format),
        48, 27, scaled_pix_fmt,
        SWS_BICUBIC, nullptr, nullptr, nullptr
    );

    if (!sws_ctx) {
        return -1;
    }

    AVFrame* frame2 = av_frame_alloc();
    frame2->width = 48;
    frame2->height = 27;
    frame2->format = scaled_pix_fmt;
    int num_bytes = av_image_get_buffer_size(scaled_pix_fmt, 48, 27, 1);
    uint8_t* frame2_buffer = (uint8_t*)av_malloc(num_bytes);

    if (!frame2 || !frame2_buffer) {
        av_free(frame2_buffer);
        av_frame_free(&frame2);
        sws_freeContext(sws_ctx);
        return -1;
    }

    av_image_fill_arrays(frame2->data, frame2->linesize, frame2_buffer, scaled_pix_fmt, 48, 27, 1);
    sws_scale(sws_ctx, frame->data, frame->linesize, 0, frame->height, frame2->data, frame2->linesize);
    frame2->color_range = AVCOL_RANGE_JPEG;

    std::ostringstream path_mini;
    path_mini << directory << '/' << std::setw(8) << std::setfill('0') << frame_num << "_mini.jpg";
    saveFrameAsJpeg(scaled_pix_fmt, frame2, path_mini.str());

    av_free(frame2_buffer);
    av_frame_free(&frame2);
    sws_freeContext(sws_ctx);
    return 0;
}

int VideoReader::generateScreenshots(const std::string& directory, const std::vector<int>& frameStamps) {
    AVPacket packet;
    int response;
    unsigned int n_frames_extracted = 0;
    frame_counter = 0;  // Reset frame counter
    last_fps_report_time = std::chrono::high_resolution_clock::now();  // Reset timing

    while (av_read_frame(format_ctx, &packet) >= 0 && n_frames_extracted < frameStamps.size() && !isCancelled()) {
        if (packet.stream_index == video_stream_index) {
            frame_counter++;

            // Report FPS every FPS_REPORT_INTERVAL frames
            if (frame_counter % FPS_REPORT_INTERVAL == 0) {
                auto current_time = std::chrono::high_resolution_clock::now();
                auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(current_time - last_fps_report_time).count();
                double current_fps = (FPS_REPORT_INTERVAL * 1000.0) / elapsed;  // Convert to frames per second
                fprintf(stderr, "Processing frame %lld, Measured FPS: %.2f\n", frame_counter, current_fps);
                last_fps_report_time = current_time;
            }

            response = avcodec_send_packet(codec_ctx, &packet);
            if (response < 0) {
                av_packet_unref(&packet);
                return -1;
            }

            response = avcodec_receive_frame(codec_ctx, frame);
            if (response == AVERROR(EAGAIN) || response == AVERROR_EOF) {
                av_packet_unref(&packet);
                continue;
            } else if (response < 0) {
                av_packet_unref(&packet);
                return -1;
            }

            if (std::find(frameStamps.begin(), frameStamps.end(), codec_ctx->frame_num -1) != frameStamps.end()) {
                fprintf(stderr, "Extracting frame %lld\n", (int64_t)(codec_ctx->frame_num - 1));
                n_frames_extracted++;
                saveFrame(directory, codec_ctx->frame_num-1);
            }
            av_packet_unref(&packet);
        }
        av_packet_unref(&packet);
    }
    return 0;
}

int VideoReader::saveFrameAsJpeg(AVPixelFormat pix_fmt, AVFrame* pFrame, const std::string& path) {
    int ret;

    const AVCodec* jpegCodec = avcodec_find_encoder(AV_CODEC_ID_MJPEG);
    if (!jpegCodec) {
        return -1;
    }

    AVCodecContext* jpegContext = avcodec_alloc_context3(jpegCodec);
    if (!jpegContext) {
        return -1;
    }

    jpegContext->pix_fmt = pix_fmt;
    jpegContext->height = pFrame->height;
    jpegContext->width = pFrame->width;
    jpegContext->color_range = pFrame->color_range;
    jpegContext->time_base = AVRational{1, 25};
    jpegContext->strict_std_compliance = FF_COMPLIANCE_UNOFFICIAL;

    if ((ret = avcodec_open2(jpegContext, jpegCodec, nullptr)) < 0) {
        printf("ret %d\n", ret);
        avcodec_free_context(&jpegContext);
        return ret;
    }

    AVPacket* packet = av_packet_alloc();
    if (!packet) {
        avcodec_free_context(&jpegContext);
        return -1;
    }

    if ((ret = avcodec_send_frame(jpegContext, pFrame)) < 0) {
        avcodec_free_context(&jpegContext);
        return ret;
    }

    if ((ret = avcodec_receive_packet(jpegContext, packet)) < 0) {
        av_packet_unref(packet);
        avcodec_free_context(&jpegContext);
        return ret;
    }

    FILE* file = fopen(path.c_str(), "wb");
    if (!file) {
        av_packet_unref(packet);
        avcodec_free_context(&jpegContext);
        return -1;
    }

    fwrite(packet->data, 1, packet->size, file);
    fclose(file);

    av_packet_unref(packet);
    avcodec_free_context(&jpegContext);

    return 0;
}

void VideoReader::setCancelled(bool value) {
    cancelled = value;
}

bool VideoReader::isCancelled() {
    return cancelled;
}
