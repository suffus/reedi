## **Migration Plan: Single Queue Architecture for Media Processing**

### **Current State Analysis**

**Existing Architecture:**
- Multiple request queues: `x.media.image.processing.requests`, `x.media.video.processing.requests`
- Multiple update queues: `x.media.image.processing.updates`, `x.media.video.processing.updates`
- Staged processing queues in media processor (constraining to single node)
- Type-specific processing services with separate RabbitMQ connections

**Problems:**
- Over-complex queue management
- Single-node processing constraints
- Inconsistent patterns across media types
- Difficult to scale and monitor

### **Target Architecture**

**Unified Queue Structure:**
- **Request Queue**: `${SYSTEM_NAME}.media.processing.requests`
- **Update Queue**: `${SYSTEM_NAME}.media.processing.updates`
- **Message Types**: Distinguished by `messageType` field in message body
- **Processing Nodes**: Any node can process any media type

### **Phase 1: Infrastructure Changes**

#### **1.1 Update RabbitMQ Namespace Utils**
- Modify `createNamespacedExchanges()` to create unified queues
- Add `media.processing.requests` and `media.processing.updates` to queue definitions
- Remove type-specific queue creation

#### **1.2 Create Unified Processing Service Base**
- Create `BaseMediaProcessingService` that extends `RabbitMQService`
- Implement common patterns: `start()`, `stop()`, `publishJob()`, `consumeUpdates()`
- Remove duplicate code from existing services

#### **1.3 Update Message Schemas**
- Define unified message structure with `messageType` field
- Create type-specific message interfaces that extend base
- Ensure backward compatibility during migration

### **Phase 2: Service Refactoring**

#### **2.1 Refactor Image Processing Service**
- Extend `BaseMediaProcessingService`
- Publish to unified request queue with `messageType: 'image'`
- Consume from unified update queue, filter by `messageType: 'image'`
- Remove duplicate RabbitMQ connection logic

#### **2.2 Refactor Video Processing Service**
- Extend `BaseMediaProcessingService`
- Publish to unified request queue with `messageType: 'video'`
- Consume from unified update queue, filter by `messageType: 'video'`
- Remove duplicate RabbitMQ connection logic

#### **2.3 Create Zip Processing Service**
- Extend `BaseMediaProcessingService`
- Publish to unified request queue with `messageType: 'zip'`
- Consume from unified update queue, filter by `messageType: 'zip'`
- Follow same pattern as other services

### **Phase 3: Media Processor Updates**

#### **3.1 Remove Staged Processing Queues**
- Delete all staged processing queue logic
- Remove single-node processing constraints
- Simplify processing flow to: consume → process → publish result

#### **3.2 Create Unified Media Processor Consumer**
- Single consumer for `${SYSTEM_NAME}.media.processing.requests`
- Route processing based on `messageType` field
- Support parallel processing of different media types
- Publish results to unified update queue

#### **3.3 Update Processing Handlers**
- Refactor image processing to work with unified queue
- Refactor video processing to work with unified queue
- Add zip processing handler
- Ensure all handlers can run concurrently

### **Phase 4: Backend Integration**

#### **4.1 Update Media Routes**
- Modify `media.ts` to use unified processing services
- Add zip file support to existing upload endpoints
- Remove type-specific queue management
- Use `BaseMediaProcessingService` for all media types

#### **4.2 Update App Initialization**
- Initialize single `BaseMediaProcessingService` instance
- Remove multiple service initializations
- Simplify startup sequence

#### **4.3 Update Progress Tracking**
- Modify progress update consumers to handle unified queue
- Filter updates by `messageType` and `mediaId`
- Maintain existing progress tracking functionality

### **Phase 5: Database Schema Updates**

#### **5.1 Add ZIP Media Type**
- Add `ZIP` to `MediaType` enum
- Update media processing status to handle zip files
- Add any zip-specific fields if needed

#### **5.2 Remove Batch Upload Tables**
- Delete `BatchUpload` model and related tables
- Remove batch upload service
- Clean up unused database fields

### **Phase 6: Frontend Updates**

#### **6.1 Update Upload Components**
- Modify `MediaUploader` to handle zip files
- Use existing chunked upload service for zip files
- Remove zip-specific upload components

#### **6.2 Update Progress Tracking**
- Modify progress components to handle unified updates
- Filter by `messageType` for different media types
- Maintain existing UI patterns

### **Phase 7: Testing and Validation**

#### **7.1 Unit Tests**
- Test unified processing service
- Test message routing and filtering
- Test concurrent processing

#### **7.2 Integration Tests**
- Test end-to-end zip processing
- Test mixed media type processing
- Test scaling with multiple nodes

#### **7.3 Performance Testing**
- Verify no performance degradation
- Test concurrent processing limits
- Validate queue throughput

### **Phase 8: Migration and Cleanup**

#### **8.1 Gradual Migration**
- Deploy new architecture alongside old
- Migrate one media type at a time
- Monitor for issues

#### **8.2 Cleanup**
- Remove old queue definitions
- Delete unused code
- Update documentation

### **Benefits of This Migration**

1. **Simplified Architecture**: Single queue per system, easier to manage
2. **Better Scalability**: Any node can process any media type
3. **Consistent Patterns**: All media types follow same processing flow
4. **Easier Monitoring**: Single point to track all processing
5. **Reduced Complexity**: Less code duplication, easier maintenance
6. **Future-Proof**: Easy to add new media types

### **Risk Mitigation**

1. **Backward Compatibility**: Keep old queues during migration
2. **Gradual Rollout**: Migrate one media type at a time
3. **Monitoring**: Track queue performance and processing times
4. **Rollback Plan**: Ability to revert to old architecture if needed

This migration will result in a much cleaner, more maintainable, and more scalable media processing architecture that follows consistent patterns across all media types.