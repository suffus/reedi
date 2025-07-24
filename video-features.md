# Specification of Video Upload Features for Reedi

Videos are to be uploadable and shareable in posts and galleries just as images are.  
When uploaded, videos will be processed and added to the user's gallery, just like images.
Just like immages, videos may have a title, description and tags.  Just like images,
videos may be added to posts and galleries.

## Implementation plan

1  Renaming the Image schema to Media.

1.1 First we shall rename the Image schema and table to Media in the backend (in prisma as well as the source code).  We shall extend the new Media model (renamed from Image) by adding various video-specific fields such as duration, codec, bitrate and framerate.  We shall also add a mediaType enum field to distinguish video from images.  There should also be a processing status field for videos including the enum states PENDING, PROCESSING, COMPLETED, REJECTED and FAILED. 

1.2  Rename PostImage as PostMedia for semantic coherence, but no new fields are needed.

1.2 Rename /images route to /media, and add support for uploading videos to /media/upload.  Other /images route methods should be renamed /media, and return types should be extended to reflect the fields we have added to the model.  The /images/upload route shoudl be renamed /media/upload, and support the uploading of videos.  In the case of videos they should be enetered into the Media table with a status of PENDING.  The imageServe (/images/serve) routes should be renamed to /media/serve, and /image/serve/{id}/thumbnail renamed to /media/serve/{id}/thumbnail.  For streaming video a /media/serve/{id}/stream route should be added.

1.3  The frontend models and hooks for RawImage and GalleryImage should be updated and renamed as Media and GalleryMedia, and made to work with the new routes.  We shall not yet add frontend support for streaming videos because we want to test several technologies first to see what works best.  

2  Implement a video processing pipe

2.1 Once videos are uploaded, they go into the PENDING state and a message is sent to the VideoProcessing service to generate different sized versions for streaming, to generate thumbnails and to add and/or extract metadata. This service will also publish the processed media to a content distribution network for more efficient streaming.  This shall be architected as a separate "media-processor" backend which communicates with the existing web application backend via a message queue and/or web hooks.



