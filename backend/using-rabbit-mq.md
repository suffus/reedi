# Using RabbitMQ

RabbitMQ is used to robustly communicte between the backend(s) and the media processor servers.  These may be remote from each other, and there may be multiple media processor servers, hence file transfer between them is arranged through S3.

The goal of using RabbitMQ is to ensure that processing instructions are reliably delivered from backends to processors, and processing results are reliably delivered back.  Since RabbitMQ is the mediator, there is no requirement that the backend or the procesor be up or accessible to each other - they simply need to access the same RabbitMQ server (or replicated servers) asynchronously.

## Set up of service

To use the service in code, it is necessary to set up various exchanges and queues which will be used to communicate processing instructions and results.

In the backend, in src/index.ts, the RabbitMQ services are initialized as a namespaced set of queues.  In particular `<service>.request`, and `<service>.updates`.  There may also be other queues defined (eg `<service>.results`).  

Since we may have multiple distinct instances of a backend and a media server running using the same RabbitMQ, the <services> are namespaced with <system>.<servicename>.  <servicename> is frequently a dot separated name for describing the service (eg `media.images`, or `media.videos`)

## Use of the service by backend

Use of the service usually involves:

1.  Uploading a file selected by the user (or some other process) to be processed to S3 (either directly, or using multipartUploadService).  
2.  Create a database record and a processing request record.
3.  Sending the request to the `<service>.request` queue.  The format of the request may vary from srevice to service.
4.  Listen to the `<service>.updates` queue for processing updates to marrk progress and completion.   Usually updates to the database records created in (2) are involved.
5.  Service may listen to other queues that were created in the setup.  For example, a `<service>.results` queue.  This may create more database records.

## Use of the service by media processor.

The media processor consumes the `<service>.request` queue and performs operations which generate new files in S3, and sends the results back to the `<service>.updates` queue.  It is up to the backend to interpret what the media processor sends. 

In some cases additional queues may be created to "stage" the procesing of files and media.  This "staging" was originally intended to stop timeouts on long running requests, but shoudl probably be removed in a refactoring since a synchronous process will suffice.

During processing, at various points, the processor sends updates back to the backend by sending them to the updates queue.

A processing service may also send messages to any other queue in order to convey a particular result.  In essence, a queue RabbitMQ is analogous to a path in HTTP, just being more reliable.
