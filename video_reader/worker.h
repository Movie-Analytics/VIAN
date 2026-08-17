#ifndef WORKER_H
#define WORKER_H

#include <napi.h>
#include <any>
#include "video_reader.h"


using WorkerFunction = std::function<void(VideoReader*, std::any&)>;
using ResultHandler = std::function<Napi::Value(Napi::Env, const std::any&)>;


// Napi::AsyncWorker deletes itself (`delete this`) right after OnOK/OnError
// runs, so nothing external may own this via a smart pointer. ownerSlot
// points at the caller's raw-pointer handle to this worker; the destructor
// clears it so that handle can't be used (or deleted) once this object is
// gone.
class Worker : public Napi::AsyncWorker {
public:
    Worker(Napi::Function& callback,
           VideoReader* videoReader,
           WorkerFunction execFunc,
           ResultHandler resultFunc,
           Worker** ownerSlot);
    ~Worker();
    void Cancel();

protected:
    void Execute() override;
    void OnOK() override;
    void OnError(const Napi::Error& error) override;

private:
    VideoReader* videoReader;
    WorkerFunction execFunction;
    ResultHandler resultHandler;
    std::any result;
    Worker** ownerSlot;
};

#endif
