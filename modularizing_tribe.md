# Modularizing Tribe HR System - Implementation Plan

## Executive Summary

This document provides a comprehensive plan for extracting the HR functionality from the Tribe application and modularizing it as an HR module (`hrm`) that conforms to the reedi module specification. The Tribe application is a fork of the reedi core social media platform with extensive HR management functionality added, including employee onboarding/offboarding, leave management, benefits administration, equipment tracking, and performance management.

The modularization will create a self-contained HR module while preserving the core reedi functionality and adhering to the module subsystem architecture defined in `module_spec.md`.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Module Scope and Boundaries](#module-scope-and-boundaries)
3. [Core Model Extensions Required](#core-model-extensions-required)
4. [Database Schema Migration](#database-schema-migration)
5. [Backend Modularization](#backend-modularization)
6. [Frontend Modularization](#frontend-modularization)
7. [Integration Points](#integration-points)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Checklist](#deployment-checklist)
11. [Risk Assessment](#risk-assessment)

---

## Current State Analysis

### Tribe Application Overview

Tribe is a comprehensive HR management system built on top of the reedi social media platform. It includes:

**Core Features (inherited from reedi):**
- User authentication and authorization
- Media management (S3-based storage)
- Posts, comments, reactions
- Groups and messaging
- Projects and task management
- Notifications
- Albums and galleries
- Events

**HR-Specific Features (to be modularized):**
1. **Employee Management** - Comprehensive employee profiles with organizational hierarchy
2. **Onboarding/Offboarding** - Complete workflow for new hires and departures
3. **Leave Management** - Leave balances, types, requests, approvals, calendar
4. **Benefits Administration** - Benefit plans and enrollments
5. **Equipment Tracking** - Equipment types, assignments, and lifecycle
6. **Document Management** - HR-specific document storage with versioning and access control
7. **Policy Management** - Company policies with acknowledgment tracking
8. **Performance Management** - Performance metrics and KPIs
9. **Compensation Tracking** - Pay changes and salary history
10. **Organizational Structure** - Departments and line management hierarchy
11. **HR Analytics** - Reporting and analytics for HR operations

### Current Architecture

**Backend (Express.js/TypeScript):**
- ~75 TypeScript files in `backend/src/`
- 88 database models (33 HR-specific)
- ~399 API endpoints across 33 route files
- Extensive RBAC (Role-Based Access Control) middleware
- Integration with S3, RabbitMQ, email services

**Frontend (Next.js 15/React 19):**
- App Router architecture (`app/` directory)
- ~118 dashboard components
- Extensive HR-specific UI components
- Multiple API hook files for HR operations
- TanStack React Query for state management

---

## Module Scope and Boundaries

### Module Name: `hrm` (Human Resources Management)

### In Scope - HR Module Features

1. **Employee Lifecycle Management**
   - Employee profile management (HR-specific data)
   - Onboarding workflows and document collection
   - Offboarding processes
   - Employee search and directory

2. **Leave Management System**
   - Leave types configuration
   - Leave balance tracking
   - Leave request submission and approval
   - Leave calendar visualization
   - Leave history and reporting
   - Manager approval workflows

3. **Benefits Administration**
   - Benefit plans configuration
   - Employee benefits enrollment
   - Benefits tracking and reporting

4. **Equipment Management**
   - Equipment types and inventory
   - Equipment assignments to employees
   - Equipment lifecycle tracking
   - Equipment return workflows

5. **HR Document Management**
   - Employee document storage and retrieval
   - Document versioning and audit trails
   - Access control for sensitive documents
   - Document categories (contracts, IDs, certifications, etc.)

6. **Policy Management**
   - Company policy storage and distribution
   - Policy acknowledgment tracking
   - Policy versioning

7. **Performance Management**
   - Performance metrics tracking
   - KPI management
   - Performance review workflows

8. **Compensation Management**
   - Pay change tracking
   - Salary history

9. **Organizational Management**
   - Department management
   - Line management hierarchy
   - Organizational chart visualization

10. **HR Analytics and Reporting**
    - Employee statistics
    - Leave analytics
    - Onboarding progress tracking
    - CSV exports for compliance

### Out of Scope - Core System Features

The following features should remain in the core reedi application:

1. **User Management** - Core user model, authentication, sessions (though extended with HR fields)
2. **Media System** - S3 integration, media processing, media permissions (used by HR module)
3. **Notification System** - Core notification infrastructure (used by HR module)
4. **Messaging** - Direct messaging and group chats
5. **Posts and Social Features** - Feed, posts, comments, reactions
6. **Projects and Tasks** - Project management features
7. **Events** - Event management
8. **Albums and Galleries** - Photo management
9. **Groups** - Community features
10. **Friends/Connections** - Social networking features

### Gray Areas Requiring Core Extension

Some features span both core and module:

1. **User Model Extensions** - HR fields on User model (see section below)
2. **Notification Types** - HR-specific notification types
3. **Media Categories** - HR document types in media system
4. **RBAC Roles** - HR-specific roles (HR_ADMIN, HR_MANAGER, etc.)

---

## Core Model Extensions Required

### User Model Extensions

**Requires Human Approval:** Yes

**Justification:** The HR module requires additional fields on the core User model to support employee information that should be accessible across the application.

**Proposed User Model Extensions:**

```typescript
// Add to core User model in schema.prisma

model User {
  // ... existing core fields ...
  
  // HR-specific fields (nullable to maintain backwards compatibility)
  employeeId       String?           @unique
  department       String?
  jobTitle         String?
  lineManagerId    String?          // Foreign key to another User
  startDate        DateTime?
  employmentStatus EmploymentStatus? @default(ACTIVE)
  employmentType   EmploymentType?
  workEmail        String?
  workPhone        String?
  mobilePhone      String?
  workLocation     String?
  executiveLevel   ExecutiveLevel?   @default(NONE)
  
  // Relations
  lineManager      User?             @relation("LineManager", fields: [lineManagerId], references: [id])
  directReports    User[]            @relation("LineManager")
  employeeProfile  EmployeeProfile?  @relation("EmployeeUser")
}

// New enums
enum EmploymentStatus {
  ACTIVE
  ON_PROBATION
  ON_LEAVE
  TERMINATED
  SUSPENDED
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERN
  TEMPORARY
}

enum ExecutiveLevel {
  NONE
  JUNIOR
  MID
  SENIOR
  LEAD
  MANAGER
  DIRECTOR
  VP
  C_LEVEL
}
```

**Alternative Approach (if core extension denied):**

If core User model extensions are not approved, we would need to:
1. Store all HR data in the `HrmEmployeeProfile` model
2. Create duplicate fields for commonly needed data (department, jobTitle)
3. Add complexity to queries that need this information
4. Accept performance trade-offs for joins

**Recommendation:** Extend the core User model. This is the pragmatic choice because:
- Employee information (department, job title) is useful for social features
- Line management hierarchy enables permission checks across the system
- The fields are nullable and don't break existing functionality
- Alternative approaches create significant complexity and performance issues

---

## Database Schema Migration

### Module-Specific Models (33 models to create with `Hrm` prefix)

All HR-specific models will be prefixed with `Hrm` to follow module naming conventions:

#### Employee and Profile Models
1. `HrmEmployeeProfile` - Detailed employee profile information
2. `HrmEmployeePersonalInfo` - Personal information (PII)
3. `HrmEmployeeTaxPayroll` - Tax and payroll information
4. `HrmEmployeeBenefits` - Employee benefits data
5. `HrmEmployeeCompanyRequirements` - Compliance requirements
6. `HrmEmployeeEmploymentEligibility` - Work authorization
7. `HrmEmployeeAdministrativeSetup` - Office setup and equipment
8. `HrmEmployeeDocument` - Links to employee documents

#### Onboarding Models
9. `HrmOnboardingInvitation` - Onboarding invitation tokens
10. `HrmOnboardingProgress` - Onboarding completion tracking
11. `HrmOnboardingTask` - Onboarding task definitions
12. `HrmOnboardingDocument` - Documents uploaded during onboarding

#### Leave Management Models
13. `HrmLeaveType` - Leave type definitions (vacation, sick, etc.)
14. `HrmLeaveBalance` - Employee leave balances
15. `HrmLeaveBalanceHistory` - Historical leave balance changes
16. `HrmLeaveRequest` (formerly `time_off_requests`) - Leave requests
17. `HrmLeaveApproval` - Leave approval workflow records
18. `HrmLeaveCalendarEvent` - Calendar integration for leave

#### Benefits Models
19. `HrmBenefitPlan` - Available benefit plans
20. `HrmBenefitsEnrollment` - Employee benefit enrollments

#### Equipment Models
21. `HrmEquipmentType` - Equipment categories
22. `HrmEquipment` - Equipment inventory
23. `HrmEquipmentAssignment` - Equipment assigned to employees

#### Document Management Models
24. `HrmDocument` - HR document metadata
25. `HrmDocumentVersion` - Document version history
26. `HrmDocumentAccessLog` - Document access audit trail
27. `HrmDocumentAuditLog` - Document change audit trail
28. `HrmFolder` - Document organization

#### Policy Models
29. `HrmPolicy` - Company policies
30. `HrmPolicyAssignment` - Policies assigned to employees
31. `HrmPolicyAcknowledgment` - Policy acknowledgment records

#### Organization Models
32. `HrmDepartment` - Department definitions
33. `HrmPayChange` - Compensation change history

#### Performance Models
34. `HrmPerformanceMetric` - Performance tracking
35. `HrmKpi` - Key performance indicators
36. `HrmMetric` - General metrics tracking

#### Audit Models
36. `HrmTeamAvailabilitySnapshot` - Team availability tracking

### Model Relationships

**Relationships to Core Models:**
- All HR models relate to the core `User` model via `userId` fields
- HR documents use core `Media` model for file storage
- Notifications integrate with core `Notification` model

**Example Model Definition:**

```prisma
// backend/src/modules/hrm/schema.prisma

model HrmEmployeeProfile {
  id                   String               @id
  userId               String               @unique
  employeeId           String               @unique
  jobTitle             String
  department           String
  lineManagerId        String?
  employmentType       EmploymentType
  employmentStatus     EmploymentStatus     @default(ACTIVE)
  startDate            DateTime             @db.Date
  endDate              DateTime?            @db.Date
  salary               Decimal?
  onboardingStatus     OnboardingStatus     @default(PENDING)
  onboardingCompletedAt DateTime?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt
  
  // Relations
  user                 users                @relation("EmployeeUser", fields: [userId], references: [id])
  lineManager          users?               @relation("EmployeeLineManager", fields: [lineManagerId], references: [id])
  personalInfo         HrmEmployeePersonalInfo?
  taxPayroll           HrmEmployeeTaxPayroll?
  benefits             HrmEmployeeBenefits?
  administrativeSetup  HrmEmployeeAdministrativeSetup?
  leaveBalances        HrmLeaveBalance[]
  leaveRequests        HrmLeaveRequest[]
  equipmentAssignments HrmEquipmentAssignment[]
  onboardingProgress   HrmOnboardingProgress?
  
  @@map("hrm_employee_profiles")
}
```

### Migration Steps

1. **Create module schema file** - Define all HR models with `Hrm` prefix
2. **Generate migration** - Create Prisma migration that adds all module tables
3. **Add to shared schema.prisma** - Integrate module models into main schema file
4. **Data migration** - If migrating from existing Tribe installation, migrate data from old table names to new prefixed names
5. **Validate relationships** - Ensure all foreign keys and relations are correct

---

## Backend Modularization

### Directory Structure

```
backend/
├── src/
│   ├── modules/
│   │   └── hrm/
│   │       ├── index.ts                    # Module registration
│   │       ├── config.ts                   # Module configuration
│   │       ├── routes/
│   │       │   ├── index.ts                # Main route registration
│   │       │   ├── employees.ts            # Employee management routes
│   │       │   ├── onboarding.ts           # Onboarding routes
│   │       │   ├── onboarding-public.ts    # Public onboarding (no auth)
│   │       │   ├── leave.ts                # Leave management routes
│   │       │   ├── leave-admin.ts          # Leave admin routes
│   │       │   ├── benefits.ts             # Benefits routes
│   │       │   ├── equipment.ts            # Equipment routes
│   │       │   ├── documents.ts            # Document management routes
│   │       │   ├── policies.ts             # Policy management routes
│   │       │   ├── performance.ts          # Performance management routes
│   │       │   ├── departments.ts          # Department management routes
│   │       │   └── analytics.ts            # HR analytics routes
│   │       ├── services/
│   │       │   ├── employeeService.ts
│   │       │   ├── onboardingService.ts
│   │       │   ├── leaveService.ts
│   │       │   ├── leaveApprovalService.ts
│   │       │   ├── benefitsService.ts
│   │       │   ├── equipmentService.ts
│   │       │   ├── documentService.ts
│   │       │   ├── policyService.ts
│   │       │   ├── performanceService.ts
│   │       │   └── analyticsService.ts
│   │       ├── middleware/
│   │       │   ├── hrAuth.ts               # HR-specific auth checks
│   │       │   ├── hrRbac.ts               # HR role-based access control
│   │       │   └── onboardingUpload.ts     # Onboarding file upload handling
│   │       ├── types/
│   │       │   ├── index.ts
│   │       │   ├── employee.ts
│   │       │   ├── leave.ts
│   │       │   ├── onboarding.ts
│   │       │   └── documents.ts
│   │       └── utils/
│   │           ├── leaveCalculations.ts
│   │           ├── employeeValidation.ts
│   │           └── hrNotifications.ts
│   ├── lib/
│   │   ├── prisma.ts                       # Shared Prisma client
│   │   └── app-logger.ts                   # Winston logger
│   └── middleware/
│       ├── auth.ts                          # Core auth middleware
│       └── errorHandler.ts                  # Error handling
```

### Route Structure

All HR routes will be under `/api/hrm/` prefix:

**Public Routes (no authentication):**
- `POST /api/hrm/onboarding/submit/:token` - Submit onboarding form
- `GET /api/hrm/onboarding/verify/:token` - Verify onboarding token
- `GET /api/hrm/onboarding/:token` - Get onboarding data

**Protected Routes (authentication required):**

**Employee Management:**
- `GET /api/hrm/employees` - List employees
- `GET /api/hrm/employees/:id` - Get employee details
- `POST /api/hrm/employees` - Create employee
- `PUT /api/hrm/employees/:id` - Update employee
- `DELETE /api/hrm/employees/:id` - Delete employee
- `GET /api/hrm/employees/stats` - Get HR statistics
- `GET /api/hrm/employees/:id/profile` - Get full employee profile
- `GET /api/hrm/organizational-chart` - Get org chart data

**Onboarding:**
- `POST /api/hrm/onboarding/invite` - Create onboarding invitation
- `GET /api/hrm/onboarding/invitations` - List invitations
- `GET /api/hrm/onboarding/submissions` - List submissions
- `PUT /api/hrm/onboarding/submissions/:id/approve` - Approve onboarding
- `PUT /api/hrm/onboarding/submissions/:id/reject` - Reject onboarding
- `PUT /api/hrm/onboarding/submissions/:id/request-revision` - Request changes

**Leave Management:**
- `GET /api/hrm/leave/types` - Get leave types
- `POST /api/hrm/leave/types` - Create leave type (admin)
- `GET /api/hrm/leave/balance` - Get my leave balances
- `GET /api/hrm/leave/requests` - Get my leave requests
- `POST /api/hrm/leave/requests` - Submit leave request
- `DELETE /api/hrm/leave/requests/:id` - Cancel leave request
- `GET /api/hrm/leave/calendar` - Get leave calendar
- `GET /api/hrm/leave/history` - Get leave history

**Leave Administration:**
- `GET /api/hrm/leave-admin/pending` - Get pending approvals
- `GET /api/hrm/leave-admin/all-requests` - Get all requests
- `PUT /api/hrm/leave-admin/requests/:id/approve` - Approve request
- `PUT /api/hrm/leave-admin/requests/:id/reject` - Reject request
- `GET /api/hrm/leave-admin/balances` - Get all employee balances
- `PUT /api/hrm/leave-admin/balances/:employeeId` - Adjust balance
- `GET /api/hrm/leave-admin/analytics` - Get leave analytics

**Documents:**
- `POST /api/hrm/documents/upload` - Upload document
- `GET /api/hrm/documents` - List documents
- `GET /api/hrm/documents/:id` - Get document
- `DELETE /api/hrm/documents/:id` - Delete document
- `GET /api/hrm/documents/:id/versions` - Get document versions
- `GET /api/hrm/documents/:id/download` - Download document

**Policies:**
- `GET /api/hrm/policies` - List policies
- `POST /api/hrm/policies` - Create policy
- `GET /api/hrm/policies/:id` - Get policy
- `POST /api/hrm/policies/:id/assign` - Assign policy to employees
- `POST /api/hrm/policies/:id/acknowledge` - Acknowledge policy
- `GET /api/hrm/policies/acknowledgments` - Get acknowledgment status

**Equipment:**
- `GET /api/hrm/equipment` - List equipment
- `POST /api/hrm/equipment` - Create equipment
- `GET /api/hrm/equipment/types` - Get equipment types
- `POST /api/hrm/equipment/assign` - Assign equipment
- `PUT /api/hrm/equipment/:id/return` - Return equipment

**Benefits:**
- `GET /api/hrm/benefits/plans` - Get benefit plans
- `GET /api/hrm/benefits/enrollment` - Get my enrollment
- `POST /api/hrm/benefits/enroll` - Enroll in benefits

**Analytics:**
- `GET /api/hrm/analytics/dashboard` - Get HR dashboard stats
- `GET /api/hrm/analytics/leave-trends` - Leave analytics
- `GET /api/hrm/analytics/onboarding-progress` - Onboarding metrics
- `GET /api/hrm/analytics/export-csv` - Export data to CSV

### Services

Each major feature area should have a dedicated service:

**EmployeeService:**
- Employee CRUD operations
- Employee search and filtering
- Organizational chart generation
- Employee status management

**OnboardingService:**
- Invitation generation with secure tokens
- Onboarding form submission
- Document collection and validation
- Approval/rejection workflow
- Email notifications for onboarding steps

**LeaveService:**
- Leave balance calculations
- Leave request validation
- Calendar availability checks
- Leave accrual management
- Historical tracking

**LeaveApprovalService:**
- Approval routing (to line manager)
- Multi-level approval workflows
- Notification triggers
- Leave calendar integration

**DocumentService:**
- Document upload/download
- Version management
- Access control checks
- Audit logging
- Integration with core Media service

**PolicyService:**
- Policy distribution
- Assignment tracking
- Acknowledgment recording
- Compliance reporting

**BenefitsService:**
- Benefit plan management
- Enrollment workflows
- Eligibility checks

**EquipmentService:**
- Equipment inventory management
- Assignment tracking
- Return workflows

**PerformanceService:**
- Metrics tracking
- KPI management
- Review workflows

**AnalyticsService:**
- HR statistics calculation
- Report generation
- Data export (CSV)

### Middleware

**hrAuth.ts:**
```typescript
// Check if user has HR role
export const requireHRRole = (roles: HRRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    const userRole = req.user.userRole
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
    }
    
    next()
  }
}
```

**hrRbac.ts:**
```typescript
// HR-specific role-based access control
export enum HRRole {
  HR_ADMIN = 'HR_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE'
}

export const canViewEmployeeData = (viewer: User, employee: User, dataLevel: DataSensitivity) => {
  // HR admins can view all data
  if (viewer.userRole === 'HR_ADMIN') return true
  
  // Managers can view their direct reports' basic data
  if (viewer.id === employee.lineManagerId && dataLevel === 'BASIC') return true
  
  // Users can view their own data
  if (viewer.id === employee.id) return true
  
  return false
}
```

### Module Registration

**backend/src/modules/hrm/index.ts:**
```typescript
import { Router, Express } from 'express'
import { authMiddleware } from '@/middleware/auth'
import log from '@/lib/app-logger'

// Import route modules
import employeeRoutes from './routes/employees'
import onboardingRoutes from './routes/onboarding'
import onboardingPublicRoutes from './routes/onboarding-public'
import leaveRoutes from './routes/leave'
import leaveAdminRoutes from './routes/leave-admin'
import benefitsRoutes from './routes/benefits'
import equipmentRoutes from './routes/equipment'
import documentsRoutes from './routes/documents'
import policiesRoutes from './routes/policies'
import performanceRoutes from './routes/performance'
import analyticsRoutes from './routes/analytics'

export const registerHRModule = (app: Express) => {
  log.info('Registering HRM module...')
  
  const router = Router()
  
  // Public routes (no auth)
  router.use('/onboarding', onboardingPublicRoutes)
  
  // Protected routes (auth required)
  router.use('/employees', authMiddleware, employeeRoutes)
  router.use('/onboarding-admin', authMiddleware, onboardingRoutes)
  router.use('/leave', authMiddleware, leaveRoutes)
  router.use('/leave-admin', authMiddleware, leaveAdminRoutes)
  router.use('/benefits', authMiddleware, benefitsRoutes)
  router.use('/equipment', authMiddleware, equipmentRoutes)
  router.use('/documents', authMiddleware, documentsRoutes)
  router.use('/policies', authMiddleware, policiesRoutes)
  router.use('/performance', authMiddleware, performanceRoutes)
  router.use('/analytics', authMiddleware, analyticsRoutes)
  
  // Register under /api/hrm
  app.use('/api/hrm', router)
  
  log.info('✅ HRM module registered successfully')
}

export const deregisterHRModule = (app: Express) => {
  log.info('Deregistering HRM module...')
  // Cleanup logic if needed
  log.info('✅ HRM module deregistered')
}
```

**Integration in backend/src/index.ts:**
```typescript
import { registerHRModule } from './modules/hrm'

// ... after other middleware setup ...

// Register modules
registerHRModule(app)

// ... rest of application setup ...
```

### Configuration

**backend/src/modules/hrm/config.ts:**
```typescript
import dotenv from 'dotenv'

dotenv.config()

export const hrmConfig = {
  // Onboarding
  onboardingTokenExpiry: parseInt(process.env.HRM_ONBOARDING_TOKEN_EXPIRY || '2592000'), // 30 days
  
  // Leave management
  defaultAnnualLeaveDays: parseInt(process.env.HRM_DEFAULT_ANNUAL_LEAVE || '20'),
  defaultSickLeaveDays: parseInt(process.env.HRM_DEFAULT_SICK_LEAVE || '10'),
  leaveRequestAdvanceNoticeDays: parseInt(process.env.HRM_LEAVE_ADVANCE_NOTICE || '14'),
  
  // Documents
  maxDocumentSizeMB: parseInt(process.env.HRM_MAX_DOCUMENT_SIZE || '25'),
  allowedDocumentTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  
  // Email notifications
  sendOnboardingEmails: process.env.HRM_SEND_ONBOARDING_EMAILS === 'true',
  sendLeaveNotifications: process.env.HRM_SEND_LEAVE_NOTIFICATIONS === 'true',
  
  // Security
  requireManagerApproval: process.env.HRM_REQUIRE_MANAGER_APPROVAL !== 'false',
  
  // Performance
  cacheTTL: parseInt(process.env.HRM_CACHE_TTL || '300'), // 5 minutes
}
```

---

## Frontend Modularization

### Directory Structure

```
frontend/
├── modules/
│   └── hrm/
│       ├── dashboard/
│       │   ├── index.tsx                        # Main HRM dashboard
│       │   ├── employees/
│       │   │   ├── employee-list.tsx
│       │   │   ├── employee-profile.tsx
│       │   │   ├── employee-search.tsx
│       │   │   ├── organizational-chart.tsx
│       │   │   └── employee-form.tsx
│       │   ├── onboarding/
│       │   │   ├── onboarding-dashboard.tsx
│       │   │   ├── onboarding-wizard.tsx
│       │   │   ├── onboarding-review.tsx
│       │   │   ├── invitation-form.tsx
│       │   │   └── onboarding-progress.tsx
│       │   ├── leave/
│       │   │   ├── leave-portal.tsx             # Employee leave view
│       │   │   ├── leave-request-form.tsx
│       │   │   ├── leave-calendar.tsx
│       │   │   ├── leave-balance-card.tsx
│       │   │   ├── admin-leave-management.tsx   # Admin view
│       │   │   ├── admin-approvals.tsx
│       │   │   ├── admin-leave-types.tsx
│       │   │   └── leave-analytics.tsx
│       │   ├── benefits/
│       │   │   ├── benefits-enrollment.tsx
│       │   │   ├── benefits-dashboard.tsx
│       │   │   └── benefit-plans.tsx
│       │   ├── equipment/
│       │   │   ├── equipment-list.tsx
│       │   │   ├── equipment-assignment.tsx
│       │   │   └── equipment-tracking.tsx
│       │   ├── documents/
│       │   │   ├── document-manager.tsx
│       │   │   ├── document-upload.tsx
│       │   │   ├── document-viewer.tsx
│       │   │   └── document-gallery.tsx
│       │   ├── policies/
│       │   │   ├── policy-list.tsx
│       │   │   ├── policy-viewer.tsx
│       │   │   ├── policy-acknowledgment.tsx
│       │   │   └── policy-management.tsx
│       │   ├── performance/
│       │   │   ├── performance-dashboard.tsx
│       │   │   ├── metrics-tracker.tsx
│       │   │   └── kpi-manager.tsx
│       │   ├── analytics/
│       │   │   ├── hr-analytics-dashboard.tsx
│       │   │   ├── reports-generator.tsx
│       │   │   └── data-export.tsx
│       │   └── shared/
│       │       ├── employee-selector.tsx
│       │       ├── department-selector.tsx
│       │       ├── date-range-picker.tsx
│       │       └── hr-data-table.tsx
│       ├── lib/
│       │   └── api-hooks.ts                     # Module-specific API hooks
│       └── types/
│           ├── index.ts
│           ├── employee.ts
│           ├── leave.ts
│           ├── onboarding.ts
│           └── documents.ts
├── components/
│   └── dashboard/
│       └── hrm/                                  # Top-half components
│           ├── hrm-tab.tsx                       # Dashboard tab registration
│           ├── hrm-notification-formatter.tsx   # Format HR notifications
│           └── hrm-menu-items.tsx               # Menu integration
├── app/
│   ├── hrm/                                      # Public HR pages
│   │   └── onboarding/
│   │       └── [token]/
│   │           └── page.tsx                      # Public onboarding form
│   └── dashboard/
│       └── page.tsx                              # Main dashboard (imports HRM tab)
```

### Module Routes (Frontend)

All HR routes will use the `/hrm/` prefix:

**Public Routes:**
- `/hrm/onboarding/:token` - Onboarding form for new employees

**Dashboard Routes (authenticated):**
- `/dashboard` with HRM tab containing:
  - Employee management
  - Onboarding administration
  - Leave management
  - Benefits administration
  - Equipment tracking
  - Document management
  - Policy management
  - Analytics and reporting

### API Hooks

**frontend/modules/hrm/lib/api-hooks.ts:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api'

// Employee hooks
export function useEmployees(filters?: EmployeeFilters) {
  return useQuery({
    queryKey: ['hrm-employees', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.department) params.append('department', filters.department)
      if (filters?.status) params.append('status', filters.status)
      
      const response = await fetch(`${API_BASE_URL}/hrm/employees?${params}`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) throw new Error('Failed to fetch employees')
      return response.json()
    }
  })
}

export function useEmployee(employeeId: string) {
  return useQuery({
    queryKey: ['hrm-employee', employeeId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/hrm/employees/${employeeId}`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) throw new Error('Failed to fetch employee')
      return response.json()
    },
    enabled: !!employeeId
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (employeeData: CreateEmployeeInput) => {
      const response = await fetch(`${API_BASE_URL}/hrm/employees`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      })
      if (!response.ok) throw new Error('Failed to create employee')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm-employees'] })
    }
  })
}

// Leave management hooks
export function useLeaveBalance() {
  return useQuery({
    queryKey: ['hrm-leave-balance'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/hrm/leave/balance`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) throw new Error('Failed to fetch leave balance')
      return response.json()
    }
  })
}

export function useLeaveRequests() {
  return useQuery({
    queryKey: ['hrm-leave-requests'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/hrm/leave/requests`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) throw new Error('Failed to fetch leave requests')
      return response.json()
    }
  })
}

export function useSubmitLeaveRequest() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (requestData: LeaveRequestInput) => {
      const response = await fetch(`${API_BASE_URL}/hrm/leave/requests`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })
      if (!response.ok) throw new Error('Failed to submit leave request')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm-leave-requests'] })
      queryClient.invalidateQueries({ queryKey: ['hrm-leave-balance'] })
    }
  })
}

// Onboarding hooks
export function useOnboardingInvitations() {
  return useQuery({
    queryKey: ['hrm-onboarding-invitations'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/hrm/onboarding-admin/invitations`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) throw new Error('Failed to fetch invitations')
      return response.json()
    }
  })
}

export function useCreateOnboardingInvitation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (invitationData: OnboardingInvitationInput) => {
      const response = await fetch(`${API_BASE_URL}/hrm/onboarding-admin/invite`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invitationData)
      })
      if (!response.ok) throw new Error('Failed to create invitation')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm-onboarding-invitations'] })
    }
  })
}

// ... more hooks for other features ...
```

### Type Definitions

**frontend/modules/hrm/types/employee.ts:**

```typescript
export interface HrmEmployee {
  id: string
  userId: string
  employeeId: string
  jobTitle: string
  department: string
  lineManagerId?: string
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  startDate: string
  endDate?: string
  onboardingStatus: OnboardingStatus
  
  // User data
  user: {
    id: string
    name: string
    email: string
    avatar?: string
    workEmail?: string
    workPhone?: string
  }
  
  // Relations
  lineManager?: HrmEmployee
  directReports: HrmEmployee[]
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
  TEMPORARY = 'TEMPORARY'
}

export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  ON_PROBATION = 'ON_PROBATION',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
  SUSPENDED = 'SUSPENDED'
}

export enum OnboardingStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD'
}

export interface CreateEmployeeInput {
  email: string
  firstName: string
  lastName: string
  jobTitle: string
  department: string
  lineManagerId?: string
  employmentType: EmploymentType
  startDate: string
  workEmail?: string
  workPhone?: string
}
```

**frontend/modules/hrm/types/leave.ts:**

```typescript
export interface HrmLeaveType {
  id: string
  name: string
  description?: string
  defaultDays: number
  color: string
  requiresApproval: boolean
  isPaid: boolean
  isActive: boolean
}

export interface HrmLeaveBalance {
  id: string
  userId: string
  leaveTypeId: string
  leaveType: HrmLeaveType
  year: number
  totalDays: number
  usedDays: number
  pendingDays: number
  availableDays: number
}

export interface HrmLeaveRequest {
  id: string
  userId: string
  user: {
    id: string
    name: string
    avatar?: string
  }
  leaveTypeId: string
  leaveType: HrmLeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  status: LeaveRequestStatus
  approverId?: string
  approver?: {
    id: string
    name: string
  }
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  createdAt: string
}

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export interface LeaveRequestInput {
  leaveTypeId: string
  startDate: string
  endDate: string
  reason: string
}
```

### Dashboard Tab Integration

**frontend/components/dashboard/hrm/hrm-tab.tsx:**

```typescript
'use client'

import { Users } from 'lucide-react'
import { lazy, Suspense } from 'react'

// Lazy load the main HRM dashboard component
const HRMDashboard = lazy(() => import('@/modules/hrm/dashboard'))

export function HRMTab() {
  return (
    <Suspense fallback={<div>Loading HR Management...</div>}>
      <HRMDashboard />
    </Suspense>
  )
}

// Tab configuration for dashboard
export const hrmTabConfig = {
  id: 'hrm',
  label: 'HR Management',
  icon: Users,
  component: HRMTab,
  requiredRole: ['HR_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE']
}
```

**Integration in main dashboard:**

```typescript
// frontend/app/dashboard/page.tsx

import { hrmTabConfig } from '@/components/dashboard/hrm/hrm-tab'

// ... other imports and tab configs ...

const availableTabs = [
  homeTabConfig,
  projectsTabConfig,
  hrmTabConfig,  // HRM tab added here
  // ... other tabs
]
```

### Public Onboarding Page

**frontend/app/hrm/onboarding/[token]/page.tsx:**

```typescript
'use client'

import { use } from 'react'
import { OnboardingWizard } from '@/modules/hrm/dashboard/onboarding/onboarding-wizard'

export default function OnboardingPage({ 
  params 
}: { 
  params: Promise<{ token: string }> 
}) {
  const { token } = use(params)
  
  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingWizard token={token} />
    </div>
  )
}
```

---

## Integration Points

### 1. Notification System Integration

**HR Notification Types:**

```typescript
enum HRNotificationType {
  ONBOARDING_INVITATION = 'hrm_onboarding_invitation',
  ONBOARDING_APPROVED = 'hrm_onboarding_approved',
  ONBOARDING_REJECTED = 'hrm_onboarding_rejected',
  ONBOARDING_REVISION_REQUESTED = 'hrm_onboarding_revision_requested',
  LEAVE_REQUEST_SUBMITTED = 'hrm_leave_request_submitted',
  LEAVE_REQUEST_APPROVED = 'hrm_leave_request_approved',
  LEAVE_REQUEST_REJECTED = 'hrm_leave_request_rejected',
  LEAVE_REQUEST_CANCELLED = 'hrm_leave_request_cancelled',
  LEAVE_BALANCE_LOW = 'hrm_leave_balance_low',
  POLICY_ASSIGNED = 'hrm_policy_assigned',
  POLICY_UPDATED = 'hrm_policy_updated',
  EQUIPMENT_ASSIGNED = 'hrm_equipment_assigned',
  EQUIPMENT_RETURN_DUE = 'hrm_equipment_return_due',
  PERFORMANCE_REVIEW_DUE = 'hrm_performance_review_due',
  DOCUMENT_EXPIRING = 'hrm_document_expiring'
}
```

**Notification Creation Helper:**

```typescript
// backend/src/modules/hrm/utils/hrNotifications.ts

import { NotificationService } from '@/services/notificationService'

export async function sendLeaveApprovalNotification(
  userId: string,
  leaveRequest: HrmLeaveRequest,
  approved: boolean
) {
  const notificationService = new NotificationService()
  
  await notificationService.createNotification({
    userId,
    type: approved ? 'hrm_leave_request_approved' : 'hrm_leave_request_rejected',
    title: approved ? 'Leave Request Approved' : 'Leave Request Rejected',
    message: `Your leave request for ${leaveRequest.days} days has been ${approved ? 'approved' : 'rejected'}`,
    link: '/dashboard?tab=hrm&section=leave',
    metadata: {
      leaveRequestId: leaveRequest.id,
      leaveType: leaveRequest.leaveType.name,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate
    }
  })
}
```

### 2. Media System Integration

HR documents are stored using the core media system with HR-specific categories:

```typescript
enum HRMediaCategory {
  EMPLOYEE_PHOTO = 'hr_employee_photo',
  ID_DOCUMENT = 'hr_id_document',
  CONTRACT = 'hr_contract',
  BANK_VERIFICATION = 'hr_bank_verification',
  CERTIFICATION = 'hr_certification',
  PERFORMANCE_REVIEW = 'hr_performance_review',
  POLICY_DOCUMENT = 'hr_policy_document',
  OTHER_HR_DOCUMENT = 'hr_other_document'
}
```

**Document Upload Integration:**

```typescript
// Upload HR document through core media service
async function uploadHRDocument(
  file: File,
  category: HRMediaCategory,
  userId: string,
  metadata: Record<string, any>
) {
  // Use core media upload
  const mediaItem = await uploadToS3(file, {
    category,
    uploadedBy: userId,
    confidentiality: 'HR_ONLY',
    metadata: {
      ...metadata,
      isHRDocument: true
    }
  })
  
  // Create HR document record
  await prisma.hrmDocument.create({
    data: {
      id: generateId(),
      mediaId: mediaItem.id,
      userId,
      category,
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type,
      metadata
    }
  })
  
  return mediaItem
}
```

### 3. Email Service Integration

HR module uses the core email service:

```typescript
import { emailService } from '@/services/emailService'

export async function sendOnboardingInvitation(
  invitation: HrmOnboardingInvitation
) {
  const onboardingUrl = `${process.env.FRONTEND_URL}/hrm/onboarding/${invitation.token}`
  
  await emailService.sendEmail({
    to: invitation.email,
    subject: 'Welcome to the team! Complete your onboarding',
    html: `
      <h1>Welcome ${invitation.firstName}!</h1>
      <p>Please complete your onboarding by clicking the link below:</p>
      <a href="${onboardingUrl}">${onboardingUrl}</a>
      <p>This link will expire in 30 days.</p>
    `
  })
}
```

### 4. Permission System Integration

HR module integrates with core RBAC:

```typescript
// Extend core UserRole enum
enum UserRole {
  // Core roles
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  
  // HR roles
  HR_ADMIN = 'HR_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE'
}
```

**Permission Checks:**

```typescript
// Can view employee data
export function canViewEmployeeData(
  viewer: User,
  employee: User,
  dataLevel: 'PUBLIC' | 'BASIC' | 'SENSITIVE' | 'HR_ONLY'
): boolean {
  // HR admins can see everything
  if (viewer.userRole === 'HR_ADMIN') return true
  
  // Self can see own data
  if (viewer.id === employee.id) {
    return dataLevel !== 'HR_ONLY'
  }
  
  // Line managers can see direct reports' basic data
  if (viewer.id === employee.lineManagerId) {
    return ['PUBLIC', 'BASIC'].includes(dataLevel)
  }
  
  // Everyone can see public data
  if (dataLevel === 'PUBLIC') return true
  
  return false
}

// Can approve leave request
export function canApproveLeave(
  approver: User,
  requester: User
): boolean {
  // HR admins can approve any request
  if (approver.userRole === 'HR_ADMIN') return true
  
  // Line managers can approve direct reports' requests
  if (approver.id === requester.lineManagerId) return true
  
  return false
}
```

### 5. Search Integration

HR employees should appear in global search:

```typescript
// Add HR-specific search indexing
export async function indexEmployeeForSearch(employee: HrmEmployee) {
  // Use core search indexing service
  await searchService.indexDocument({
    id: employee.id,
    type: 'hrm_employee',
    title: employee.user.name,
    content: `${employee.jobTitle} ${employee.department}`,
    url: `/dashboard?tab=hrm&view=employee&id=${employee.id}`,
    metadata: {
      employeeId: employee.employeeId,
      department: employee.department,
      jobTitle: employee.jobTitle
    }
  })
}
```

### 6. Analytics Integration

HR analytics should integrate with core analytics:

```typescript
// Track HR-specific events
export function trackHREvent(
  userId: string,
  eventType: string,
  metadata: Record<string, any>
) {
  // Use core analytics service
  analyticsService.track({
    userId,
    event: `hrm_${eventType}`,
    properties: metadata,
    timestamp: new Date()
  })
}

// Examples:
trackHREvent(userId, 'leave_request_submitted', { leaveType: 'vacation', days: 5 })
trackHREvent(userId, 'onboarding_completed', { daysToComplete: 3 })
trackHREvent(userId, 'document_uploaded', { documentType: 'contract' })
```

---

## Migration Strategy

### Phase 1: Preparation (Week 1-2)

**Goals:**
- Set up module structure
- Define interfaces between core and module
- Create migration plan

**Tasks:**
1. Create module directory structure in core reedi codebase
2. Document all API contracts between core and module
3. Identify all dependencies on core models
4. Create module configuration files
5. Set up module metadata (module.json)

**Deliverables:**
- Empty module scaffolding
- API interface documentation
- Migration checklist

### Phase 2: Database Migration (Week 3)

**Goals:**
- Migrate database schema with module prefixes
- Ensure backward compatibility

**Tasks:**
1. Create new Prisma models with `Hrm` prefix
2. Generate migration scripts
3. Test migrations on staging database
4. Create data migration scripts (if migrating from existing Tribe)
5. Validate all foreign key relationships

**Deliverables:**
- Prisma schema with all HR models
- Migration scripts
- Rollback procedures

**Migration Script Example:**

```sql
-- Migrate employee_profiles to hrm_employee_profiles
INSERT INTO hrm_employee_profiles (
  id, userId, employeeId, jobTitle, department, 
  lineManagerId, employmentType, employmentStatus, 
  startDate, onboardingStatus, createdAt, updatedAt
)
SELECT 
  id, userId, employeeId, jobTitle, department,
  lineManagerId, employmentType, employmentStatus,
  startDate, onboardingStatus, createdAt, updatedAt
FROM employee_profiles;

-- Migrate leave_balances to hrm_leave_balances
INSERT INTO hrm_leave_balances (
  id, userId, leaveTypeId, year, totalDays, 
  usedDays, pendingDays, createdAt, updatedAt
)
SELECT
  id, userId, leaveTypeId, year, totalDays,
  usedDays, pendingDays, createdAt, updatedAt
FROM leave_balances;

-- ... more migrations ...
```

### Phase 3: Backend Migration (Week 4-6)

**Goals:**
- Move backend code to module structure
- Update imports and references
- Maintain API compatibility

**Tasks:**
1. **Week 4: Services and Utilities**
   - Move services to `modules/hrm/services/`
   - Move utilities to `modules/hrm/utils/`
   - Update imports to use absolute paths
   - Test service layer independently

2. **Week 5: Routes and Middleware**
   - Move routes to `modules/hrm/routes/`
   - Move middleware to `modules/hrm/middleware/`
   - Update route paths to use `/api/hrm/` prefix
   - Maintain backward compatibility with old paths (temporary redirects)

3. **Week 6: Integration and Testing**
   - Implement module registration
   - Test all API endpoints
   - Verify authentication and authorization
   - Performance testing

**Deliverables:**
- Fully functional backend module
- API documentation
- Test coverage reports

### Phase 4: Frontend Migration (Week 7-9)

**Goals:**
- Move frontend code to module structure
- Update imports and routes
- Implement lazy loading

**Tasks:**
1. **Week 7: Component Migration**
   - Move dashboard components to `modules/hrm/dashboard/`
   - Create top-half components in `components/dashboard/hrm/`
   - Update component imports

2. **Week 8: Hooks and State**
   - Move API hooks to `modules/hrm/lib/api-hooks.ts`
   - Update API endpoints to `/api/hrm/`
   - Test data fetching and caching
   - Migrate type definitions

3. **Week 9: Routes and Navigation**
   - Update public routes to `/hrm/`
   - Implement lazy loading for dashboard tab
   - Test navigation and deep linking
   - Update breadcrumbs and UI elements

**Deliverables:**
- Fully functional frontend module
- Lazy-loaded components
- Type-safe API layer

### Phase 5: Integration Testing (Week 10)

**Goals:**
- End-to-end testing of all features
- Performance validation
- Security audit

**Tasks:**
1. Test all HR workflows end-to-end
2. Verify notification integration
3. Test media upload/download
4. Verify permission checks
5. Performance testing (load times, API response times)
6. Security audit (data access, authentication)
7. Cross-browser testing
8. Mobile responsiveness testing

**Deliverables:**
- Test results report
- Performance metrics
- Security audit report

### Phase 6: Documentation and Training (Week 11)

**Goals:**
- Complete documentation
- Create user guides
- Train administrators

**Tasks:**
1. Write API documentation
2. Create user guides for HR features
3. Document deployment procedures
4. Create troubleshooting guides
5. Train HR administrators
6. Create video tutorials (optional)

**Deliverables:**
- Complete module documentation
- User guides
- Training materials

### Phase 7: Deployment (Week 12)

**Goals:**
- Deploy to production
- Monitor and support

**Tasks:**
1. Deploy database migrations
2. Deploy backend module
3. Deploy frontend module
4. Monitor for errors
5. Gather user feedback
6. Quick fixes for any issues

**Deliverables:**
- Production deployment
- Monitoring dashboards
- Post-deployment report

---

## Testing Strategy

### Unit Testing

**Backend:**
```typescript
// tests/modules/hrm/services/leaveService.test.ts

describe('LeaveService', () => {
  describe('calculateLeaveDays', () => {
    it('should calculate working days excluding weekends', () => {
      const startDate = new Date('2024-01-01') // Monday
      const endDate = new Date('2024-01-05') // Friday
      const days = leaveService.calculateLeaveDays(startDate, endDate)
      expect(days).toBe(5)
    })
    
    it('should exclude public holidays', () => {
      // Test with holidays
    })
  })
  
  describe('validateLeaveRequest', () => {
    it('should reject requests with insufficient balance', async () => {
      // Test validation
    })
  })
})
```

**Frontend:**
```typescript
// frontend/modules/hrm/__tests__/useLeaveBalance.test.ts

describe('useLeaveBalance', () => {
  it('should fetch leave balance successfully', async () => {
    // Test hook
  })
  
  it('should handle errors gracefully', async () => {
    // Test error handling
  })
})
```

### Integration Testing

**API Tests:**
```typescript
// tests/modules/hrm/integration/leave.test.ts

describe('Leave Management API', () => {
  it('should submit and approve leave request', async () => {
    // 1. Create employee
    // 2. Create leave balance
    // 3. Submit leave request
    // 4. Approve request
    // 5. Verify balance updated
  })
})
```

**Workflow Tests:**
```typescript
describe('Onboarding Workflow', () => {
  it('should complete full onboarding process', async () => {
    // 1. Create invitation
    // 2. Submit onboarding form
    // 3. Upload documents
    // 4. Approve onboarding
    // 5. Verify employee created
  })
})
```

### End-to-End Testing

Use Playwright or Cypress:

```typescript
// e2e/hrm/leave-request.spec.ts

test('Employee can submit leave request', async ({ page }) => {
  await page.goto('/dashboard')
  await page.click('[data-testid="hrm-tab"]')
  await page.click('[data-testid="leave-request-button"]')
  await page.fill('[name="startDate"]', '2024-06-01')
  await page.fill('[name="endDate"]', '2024-06-05')
  await page.fill('[name="reason"]', 'Vacation')
  await page.click('[type="submit"]')
  await expect(page.locator('.success-message')).toBeVisible()
})
```

### Performance Testing

**API Performance:**
- Test response times for all endpoints
- Load testing with multiple concurrent users
- Database query optimization

**Frontend Performance:**
- Measure bundle size for lazy-loaded chunks
- Test initial load time
- Measure time to interactive

**Targets:**
- API response time: < 200ms (p95)
- Page load time: < 2s
- Time to interactive: < 3s
- Bundle size (HRM module): < 500KB

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] End-to-end tests passing
- [ ] Performance tests passing
- [ ] Security audit completed
- [ ] Documentation complete
- [ ] Migration scripts tested
- [ ] Rollback procedures documented
- [ ] Stakeholder approval obtained

### Database

- [ ] Backup production database
- [ ] Test migrations on staging
- [ ] Run migrations on production
- [ ] Verify data integrity
- [ ] Update indexes

### Backend Deployment

- [ ] Deploy backend module code
- [ ] Update environment variables
- [ ] Restart backend services
- [ ] Verify health checks
- [ ] Monitor error logs
- [ ] Test API endpoints

### Frontend Deployment

- [ ] Build frontend with module
- [ ] Deploy frontend assets
- [ ] Clear CDN cache
- [ ] Verify lazy loading works
- [ ] Test in multiple browsers
- [ ] Test on mobile devices

### Post-Deployment

- [ ] Monitor application logs
- [ ] Monitor performance metrics
- [ ] Check error tracking (Sentry/similar)
- [ ] Verify notifications working
- [ ] Test critical workflows
- [ ] Gather user feedback
- [ ] Document any issues
- [ ] Plan follow-up fixes

### Communication

- [ ] Notify users of new features
- [ ] Send migration announcement
- [ ] Provide user guides
- [ ] Announce in company channels
- [ ] Schedule training sessions

---

## Risk Assessment

### High Risk Items

#### 1. User Model Extensions

**Risk:** Core team may reject extending User model with HR fields

**Impact:** High - Would require significant rearchitecture

**Mitigation:**
- Present strong justification for extensions
- Show performance impact is minimal
- Offer alternative approaches
- Demonstrate that fields are nullable and optional

**Contingency:**
- Store all data in HrmEmployeeProfile
- Accept performance trade-offs
- Add caching layer for frequently accessed data

#### 2. Data Migration

**Risk:** Data loss or corruption during migration from Tribe to modular structure

**Impact:** Critical - Could lose employee data

**Mitigation:**
- Comprehensive backup procedures
- Test migrations extensively on staging
- Run migrations during low-traffic periods
- Implement verification scripts
- Have rollback procedures ready

**Contingency:**
- Restore from backup
- Run migration again
- Manual data correction if needed

#### 3. API Compatibility

**Risk:** Breaking changes to existing API endpoints

**Impact:** High - Could break existing integrations

**Mitigation:**
- Maintain backward compatibility
- Add redirects from old paths
- Version the API
- Provide migration guides
- Deprecation warnings before removal

**Contingency:**
- Keep old endpoints running temporarily
- Provide adapters for old API format

### Medium Risk Items

#### 4. Performance Degradation

**Risk:** Module architecture adds latency

**Impact:** Medium - Could affect user experience

**Mitigation:**
- Lazy loading for frontend
- Optimize database queries
- Add caching where appropriate
- Monitor performance metrics
- Load testing before deployment

**Contingency:**
- Performance optimization sprint
- Add more caching
- Optimize slow queries

#### 5. Notification Integration

**Risk:** HR notifications may not work correctly with core system

**Impact:** Medium - Users miss important alerts

**Mitigation:**
- Test notification flow thoroughly
- Implement notification types correctly
- Verify email delivery
- Test in-app notifications

**Contingency:**
- Add module-specific notification queue
- Implement retry logic
- Add fallback email system

#### 6. Permission System Complexity

**Risk:** Complex permission rules may have security gaps

**Impact:** Medium - Unauthorized data access

**Mitigation:**
- Comprehensive permission testing
- Security audit
- Fail-closed by default
- Extensive logging of permission checks

**Contingency:**
- Patch security issues immediately
- Add additional permission checks
- Audit logs for unauthorized access

### Low Risk Items

#### 7. UI Consistency

**Risk:** Module UI may not match core application

**Impact:** Low - Affects user experience but not functionality

**Mitigation:**
- Reuse core components where possible
- Follow core design system
- UI/UX review before deployment

**Contingency:**
- UI polish sprint
- Update styles to match core

#### 8. Documentation Gaps

**Risk:** Insufficient documentation for users/developers

**Impact:** Low - Increases support burden

**Mitigation:**
- Comprehensive documentation plan
- User guides and developer docs
- Training materials

**Contingency:**
- Create documentation as issues arise
- FAQ based on support tickets

---

## Success Criteria

### Technical Success Criteria

1. **Modularity**
   - All HR code in `modules/hrm/` directory
   - No cross-module dependencies
   - Clean separation of concerns

2. **Performance**
   - API response times < 200ms (p95)
   - Frontend load time < 2s
   - Database queries optimized
   - Lazy loading implemented

3. **Security**
   - All sensitive data properly protected
   - RBAC implemented correctly
   - Audit logging in place
   - Security audit passed

4. **Testing**
   - > 80% code coverage
   - All critical paths tested
   - E2E tests for main workflows
   - Performance tests passing

5. **Documentation**
   - API documentation complete
   - User guides available
   - Developer documentation
   - Deployment guides

### Business Success Criteria

1. **Feature Parity**
   - All Tribe HR features working
   - No regression in functionality
   - User workflows intact

2. **User Adoption**
   - HR staff trained
   - Employees can use system
   - Positive user feedback

3. **Reliability**
   - 99.9% uptime
   - < 5 critical bugs in first month
   - Fast issue resolution

4. **Maintainability**
   - Easy to add new features
   - Clear code organization
   - Good developer experience

---

## Future Enhancements

### Features Not in Initial Scope

1. **Advanced Reporting**
   - Custom report builder
   - Scheduled reports
   - Advanced analytics dashboards

2. **Workflow Automation**
   - Configurable approval workflows
   - Automated onboarding tasks
   - Rule-based notifications

3. **Integration with External Systems**
   - Payroll system integration
   - ATS (Applicant Tracking System) integration
   - Background check services
   - Benefits provider APIs

4. **Mobile Application**
   - Native mobile app for leave requests
   - Push notifications
   - Mobile document upload

5. **Self-Service Portal Enhancements**
   - Employee self-update of information
   - Benefits comparison tools
   - Career development planning

6. **Advanced Leave Management**
   - Time-off in hours (not just days)
   - Shift-based leave tracking
   - Team calendar view
   - Leave forecasting

7. **Performance Management Expansion**
   - 360-degree reviews
   - Goal setting and OKRs
   - Skills matrix
   - Succession planning

8. **Compliance Features**
   - GDPR compliance tools
   - Data retention policies
   - Compliance reporting
   - Audit trail enhancements

9. **AI/ML Features**
   - Document classification
   - Anomaly detection
   - Predictive analytics
   - Chatbot for HR queries

10. **Line Management Features (Currently Missing)**
    - Manager dashboard showing direct reports
    - Team leave calendar
    - Quick approval workflows
    - Team performance overview
    - 1-on-1 meeting scheduler
    - Direct report development tracking

---

## Conclusion

This modularization plan provides a comprehensive roadmap for extracting the HR functionality from Tribe and integrating it into the core reedi application as a self-contained module. The plan addresses:

1. **Clear Boundaries** - Defines what belongs in the module vs. core
2. **Technical Architecture** - Detailed structure for backend and frontend
3. **Integration Points** - How the module connects with core services
4. **Migration Strategy** - Phased approach with clear deliverables
5. **Risk Management** - Identifies risks and mitigation strategies
6. **Quality Assurance** - Comprehensive testing strategy
7. **Future Roadmap** - Enhancements not in initial scope

The key challenges are:

1. **User Model Extensions** - Requires core team approval
2. **Data Migration** - Must be executed flawlessly
3. **Performance** - Must maintain fast load times with modular architecture
4. **Backward Compatibility** - Cannot break existing functionality

With careful execution following this plan, the HR module will provide a robust, maintainable, and scalable HR management system that integrates seamlessly with the reedi platform while maintaining clear separation of concerns.

The estimated timeline is **12 weeks** for full implementation, with potential for parallelization of some tasks to reduce overall time. Post-deployment support and iteration will be ongoing based on user feedback and evolving requirements.

## Next Steps

1. **Obtain Approval** for User model extensions
2. **Review Plan** with core development team
3. **Set Up Development Environment** with module structure
4. **Begin Phase 1** - Preparation and scaffolding
5. **Regular Check-ins** - Weekly progress reviews
6. **Adjust Plan** - Based on discoveries during implementation

This plan should serve as a living document, updated as the project progresses and new information emerges.

