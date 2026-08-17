#include "worker.h"


Worker::Worker(Napi::Function& callback,
               VideoReader* videoReader,
               WorkerFunction execFunc,
               ResultHandler resultFunc,
               Worker** ownerSlot)
    : Napi::AsyncWorker(callback),
      videoReader(videoReader),
      execFunction(std::move(execFunc)),
      resultHandler(std::move(resultFunc)),
      ownerSlot(ownerSlot) {}

Worker::~Worker() {
    if (ownerSlot && *ownerSlot == this) {
        *ownerSlot = nullptr;
    }
}

void Worker::Cancel() {
    if (videoReader) {
        videoReader->setCancelled(true);
    }
}

void Worker::Execute() {
    try {
        execFunction(videoReader, result);
        if (videoReader->isCancelled()) {
            SetError("Operation cancelled");
        }
    } catch (const std::exception& e) {
        SetError(e.what());
    }
}

void Worker::OnOK() {
    Napi::HandleScope scope(Env());
    Napi::Value jsResult = resultHandler(Env(), result);
    Callback().Call({Env().Null(), jsResult});
}

void Worker::OnError(const Napi::Error& error) {
    Callback().Call({error.Value(), Env().Undefined()});
}
