#ifndef VIDEO_READER_WRAPPER_H
#define VIDEO_READER_WRAPPER_H

#include <napi.h>
#include "video_reader.h"
#include "worker.h"

class VideoReaderWrapper : public Napi::ObjectWrap<VideoReaderWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoReaderWrapper(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference* constructor;
    bool finished = false;
    std::unique_ptr<Worker> currentWorker;
    std::unique_ptr<VideoReader> videoReader;

    Napi::Value Open(const Napi::CallbackInfo& info);
    Napi::Value GetFrameRate(const Napi::CallbackInfo& info);
    Napi::Value GetHeight(const Napi::CallbackInfo& info);
    Napi::Value GetNumFrames(const Napi::CallbackInfo& info);
    Napi::Value GetWidth(const Napi::CallbackInfo& info);
    Napi::Value GetCodecName(const Napi::CallbackInfo& info);
    Napi::Value GetPixelFormat(const Napi::CallbackInfo& info);
    Napi::Value GetFormatName(const Napi::CallbackInfo& info);
    Napi::Value GetBitRate(const Napi::CallbackInfo& info);
    Napi::Value ReadNextFrame(const Napi::CallbackInfo& info);
    Napi::Value Done(const Napi::CallbackInfo& info);
    Napi::Value DetectShots(const Napi::CallbackInfo& info);
    Napi::Value GenerateScreenshots(const Napi::CallbackInfo& info);
    Napi::Value GenerateScreenshot(const Napi::CallbackInfo& info);
    Napi::Value CancelOperation(const Napi::CallbackInfo& info);
    Napi::Value QueueWorker(const Napi::CallbackInfo& info,
                            WorkerFunction execFunc,
                            ResultHandler resultFunc);
};

#endif
