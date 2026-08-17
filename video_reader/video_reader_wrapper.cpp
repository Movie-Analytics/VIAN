#include "video_reader_wrapper.h"

Napi::Value VideoReaderWrapper::CancelOperation(const Napi::CallbackInfo& info) {
    if (currentWorker) {
        currentWorker->Cancel();
    }
    return info.Env().Undefined();
}

Napi::Value VideoReaderWrapper::DetectShots(const Napi::CallbackInfo& info) {
    if (info.Length() < 2 || !info[0].IsString()) {
        throw Napi::TypeError::New(info.Env(), "Expected model path and callback function");
    }

    std::string modelPath = info[0].As<Napi::String>();

    auto execFunc = [modelPath](VideoReader* reader, std::any& result) {
        result = reader->DetectShots(modelPath);
    };

    auto resultHandler = [](Napi::Env env, const std::any& result) {
        const auto& shots = std::any_cast<const std::vector<std::vector<int>>>(result);

        Napi::Array shotsArray = Napi::Array::New(env, shots.size());
        for (size_t i = 0; i < shots.size(); ++i) {
            Napi::Array shotArray = Napi::Array::New(env, 2);
            shotArray.Set(0u, Napi::Number::New(env, shots[i][0]));
            shotArray.Set(1u, Napi::Number::New(env, shots[i][1]));
            shotsArray.Set(i, shotArray);
        }
        return shotsArray;
    };

    return QueueWorker(info, execFunc, resultHandler);
}

Napi::Value VideoReaderWrapper::GenerateScreenshots(const Napi::CallbackInfo& info) {
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsArray()) {
        throw Napi::TypeError::New(info.Env(),
            "Directory path and frame stamps array are required");
    }

    std::string directory = info[0].As<Napi::String>();
    Napi::Array frameStampsArray = info[1].As<Napi::Array>();

    std::vector<int> frameStamps;
    for (size_t i = 0; i < frameStampsArray.Length(); ++i) {
        Napi::Value elem = frameStampsArray[i];

        if (!elem.IsNumber()) {
            throw Napi::TypeError::New(info.Env(),
                "Frame stamp must be an array of integers");
        }

        frameStamps.push_back(elem.As<Napi::Number>());
    }

    auto execFunc = [directory, frameStamps](VideoReader* reader, std::any& result) {
        result = reader->generateScreenshots(directory, frameStamps);
    };

    auto resultHandler = [](Napi::Env env, const std::any& result) {
        int success = std::any_cast<int>(result);
        return Napi::Boolean::New(env, success >= 0);
    };

    return QueueWorker(info, execFunc, resultHandler);
}

Napi::Value VideoReaderWrapper::GenerateScreenshot(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Directory path and frame number are required").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string directory = info[0].As<Napi::String>();
    Napi::Number frame_num = info[1].As<Napi::Number>();

    int result = videoReader->generateScreenshot(directory, frame_num);
    if (result < 0) {
        Napi::Error::New(env, "Failed to generate screenshots").ThrowAsJavaScriptException();
        return env.Null();
    }

    return Napi::Boolean::New(env, true);
}

Napi::FunctionReference* VideoReaderWrapper::constructor = nullptr;

Napi::Object VideoReaderWrapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoReader", {
        InstanceMethod<&VideoReaderWrapper::Open>("open"),
        InstanceMethod<&VideoReaderWrapper::GetFrameRate>("getFrameRate"),
        InstanceMethod<&VideoReaderWrapper::GetHeight>("getHeight"),
        InstanceMethod<&VideoReaderWrapper::GetNumFrames>("getNumFrames"),
        InstanceMethod<&VideoReaderWrapper::GetWidth>("getWidth"),
        InstanceMethod<&VideoReaderWrapper::GetCodecName>("getCodecName"),
        InstanceMethod<&VideoReaderWrapper::GetPixelFormat>("getPixelFormat"),
        InstanceMethod<&VideoReaderWrapper::GetFormatName>("getFormatName"),
        InstanceMethod<&VideoReaderWrapper::GetBitRate>("getBitRate"),
        InstanceMethod<&VideoReaderWrapper::DetectShots>("detectShots"),
        InstanceMethod<&VideoReaderWrapper::GenerateScreenshots>("generateScreenshots"),
        InstanceMethod<&VideoReaderWrapper::GenerateScreenshot>("generateScreenshot"),
        InstanceMethod<&VideoReaderWrapper::Done>("done"),
        InstanceMethod<&VideoReaderWrapper::CancelOperation>("cancelOperation"),
    });

    constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    exports.Set("VideoReader", func);
    env.SetInstanceData<Napi::FunctionReference>(constructor);
    return exports;
}

VideoReaderWrapper::VideoReaderWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoReaderWrapper>(info), finished(false) {
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(info.Env(), "File path is required").ThrowAsJavaScriptException();
    }

    std::string filePath = info[0].As<Napi::String>();
    videoReader = std::make_unique<VideoReader>(filePath);
}

Napi::Value VideoReaderWrapper::Open(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    bool success = videoReader->Open();
    return Napi::Boolean::New(env, success);
}
Napi::Value VideoReaderWrapper::GetFrameRate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double fps = videoReader->getFrameRate();
    return Napi::Number::New(env, fps);
}

Napi::Value VideoReaderWrapper::GetHeight(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double height = videoReader->getHeight();
    return Napi::Number::New(env, height);
}

Napi::Value VideoReaderWrapper::GetNumFrames(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double nframes = videoReader->getNumFrames();
    return Napi::Number::New(env, nframes);
}

Napi::Value VideoReaderWrapper::GetWidth(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double width = videoReader->getWidth();
    return Napi::Number::New(env, width);
}

Napi::Value VideoReaderWrapper::GetCodecName(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::String::New(env, videoReader->getCodecName());
}

Napi::Value VideoReaderWrapper::GetPixelFormat(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::String::New(env, videoReader->getPixelFormat());
}

Napi::Value VideoReaderWrapper::GetFormatName(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::String::New(env, videoReader->getFormatName());
}

Napi::Value VideoReaderWrapper::GetBitRate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double bitRate = videoReader->getBitRate();
    return Napi::Number::New(env, bitRate);
}

Napi::Value VideoReaderWrapper::Done(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, videoReader->Done());
}

Napi::Value VideoReaderWrapper::QueueWorker(
    const Napi::CallbackInfo& info,
    WorkerFunction execFunc,
    ResultHandler resultFunc) {

    Napi::Env env = info.Env();

    if (!info[info.Length() - 1].IsFunction()) {
        throw Napi::TypeError::New(env, "Last argument must be a callback function");
    }

    Napi::Function callback = info[info.Length() - 1].As<Napi::Function>();

    currentWorker = new Worker(
        callback,
        videoReader.get(),
        std::move(execFunc),
        std::move(resultFunc),
        &currentWorker
    );

    currentWorker->Queue();
    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    VideoReaderWrapper::Init(env, exports);
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
