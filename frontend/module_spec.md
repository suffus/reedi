# Specification of module subsystem

The module subsystem is a system which enables us to create modules which connect with reedi, share the look-and-feel, users and permissions structure, but provide functionality independent of the social media app.  Examples of modules might include:

- HR onboarding and offboarding
- CRM functionality linking reedi with customers
- Ticket tracking system for support requests.
- IT systems monitoring module


Modules share the common system for handling users, security, permissions, notifications, media items, data storage on S3 (via the media processor).  Apart from this they are free to implement their own features and data striuctures, but with certain naming conventions.  

Modules are registered to users or to groups of users (eg, finance managers, IT support desk).  If a user is registered to a module, it will appear as a tab in their dashboard.

## Frontend

For the frontend, the coding naming conventions are that each module which appears on the dashboard will appear in a directory named `frontend/modules/<module_prefix>/dashboard/<dashboard-component>.tsx`.  Backend module-specific hooks for api calls will added to `frontend/modules/<module_prefix>/lib/api-hooks.ts`.  Only the module code will use its module-specific hooks.  All modules may access core hooks and state methods by importing and using `/lib/api-hooks.ts`.

The frontend should maintain a consistent look-and-feel with the rest of the application, where appropriate reusing css classes and implementation method in tailwind.  Colours should be consistent, as shoudl the look-and-feel of buttons, form controls, headers and footers, content controls, fonts, layouts, and so on.

### Modularity 

Modules should be *modular* and never reference code or components in other modules.  They may reference the common components and code in the core reedi application.

### Frontend API and Architecture

The enclosing system will expose a reedi API to help the module access its services and data.  Each module will have a "top-half" which will allow it to be displayed as a tab in the dashboard, and to be inserted into relevant menu items, and a "bottom half" which will contain most of the code and implementation logic.  This will allow the bottom half of a module to be served separately, but for its stubs to be incorporated directly into the application for maximum flexibility.

## Backend

Each module may implement its own authorization logic, but should make use of the application-wide faceted permissions system where possible.

If a module needs to send a notification to a user, it shoudl use the system-wide notification subsystem.  Similarly for other forms of communication (email, SMS, whatsapp...).  If a module is communicating with non-users, it is free to use whatever systems are most appropriate.

If a module needs to store an image, video, document, audio-file or other file-type artifact, it should do so using the media item system used in the rest of the system, if necessary asking permission to extend this subsystem.

### Database

Where the module needs to extend the database, it should only do so on approval of a human after explaining why it needs to extend the database, and unless explicitly instructed by a human should NEVER remove existing fields or tables or rename them.

The naming convention for tables and fields should folllow the naming convention in schema.prisma, namely models should be in singular PascalCase @@map'd to plural snake_case tables in the database and fields should be in camelCase both in the model and the database.   

### Services

The backend should add module-specific services to the codebase in the directory `src/modules/<module_prefix>/services/<serviceName>.ts`.  Naming convention for files should be camel case.

### Routes

Each module should add its own route file in `src/modules/<module_prefix>/index.ts`, which for complex modules may include multiple files.  Where possible, file lengths should be kept to less than 1000 lines of code.  These will be incorporated into the main application through the registration mechanism described below.

### Middleware

Modules should *not* modify application middlleware without explicit instruction from a human. f a module wishes to use its own middleware for some routes, then it should create it in `src/modules/<module_prefix>/middleware/`. 

### Config

Where appropriate, modules may add their own config class which parse the .env file underneath `src/modules/<module_prefix>/config.ts`.  

### API

Modules register themselves by calling `reedi.registerModule(name: string, addRoutes: (app: typeof express()) => typeof express(), deregister: (app: typeof express()) => void)` which will allow it to add its own routes.  The reedi system will call the registration functions on startup and the dregistration function on shutdown.


## Further details 

### Module discovery and loading

modules available to the user will be returned by `reedi.getModulesForUser()` in the backend which will be in the information returned by the login call and maintained in the session.  This this information will be returned in `/login`, and by the `/auth/me` call.  This call will consult the database, and initially we shall simply add a JSON field to the user table with an array of module names for each user (default `[]`).  There will be an administration interface where an administrator can register modules to users or to entire groups of users.

For the frontend, since the top half of each module will be compiled with the frontend, this will allow for displaying tabs, inserting menu items, etc, without the need for serving the entire code module.  By wrapping the module component(s) in <Suspense> nextjs should defer rendering.

This gives rise to a top-half/bottom-half architecture for each module where:

1. Items which need to be displayed quickly (such as tabs, menu items, icons, code for formatting notifications and alerts specific to the module) are compiled into the core application since they don't increase bundle size much and provide a fluid user experience.  
2. The main components of a module (and their associated logic), however, will be much larger and need to be compiled into a separate javascript file that is served only when required through lazy loading.  How this is achieved in nextjs is TBD.   


### Faceted Authorization System

In order to support features such as 'this operation is only available for "Devops Managers" (and above) who have "Capability:Manage technical systems" capability in the cluster "Cluster:India-Live" that have been authenticated by text message and yubikey'. then each user session will be assicated with various facets inherited from the user, the user's facets (job title, location, capabilities) annd the facets of the session authentication (authentication methods).  These facets will be combined together and evaluated to give an answer to "can this user session to this action?".

The details of this authentication and authorization system will need to be confirmed.

### Module registration and metadata

Each module will have a JSON file specifying its metadata including 

- display name
- prefix
- description
- icons
- version
- dependencies on core

Modules are essentially all compiled into the codebase so no registration mechanism is necessary save that in the backend modules need to be able to register their relevant routes and deregistration function, and in the frontend, separation of module logic code from core code will help to reduce load times.

The goal of the system is *not* to provide a means of developing modules independently of the core application, but a means of ensuring that AI does not write zeros all over the core.

### Routing and URLs

For the backend, the module is responsible for defining its routes.  All routes should be added under the `/api/<module_prefix>/` path.

For the frontend, the path `/<module_prefix>/` should be used.

### Migrations

Database migrathions for modules should be applied together with core database migrations; there should be one prisma file which is shared by the core and all modules.  Any changes to this prisma file that modify any core tables will need to be reviewed and approved by a human.

All module specific tables/models will be prefixed with the module prefix, thereby avoiding name conflicts and clearly sparating module tables from core tables.


### Testing conventions

Each module should define its own unit and integration tests in `tests/modules/<module_prefix>`.  The core framework should be extended to optionally test modules also.

### Type definitions

There should be no shared type definitions between frontend and backend.  Rather two sets of types shoudl be kept in sync.  This is one of the few exceptions to DRY that we can tolerate.

Synchronisation is mainly required for types which are transmitted to and from the API in javascript.  In this case, we shall use zod to make sure the data being sent and returned is sensible and as expected.

### State Management.  

Modules should have access to global core system state, but may add to it using tanstack query , like the core does (or should do).  Modules may access core state either through localStorage or through importing the api hooks which refer to the core state.


### Logging and Error Handling

Errors should be returned to the frontend using HTTP semantic codes as far as possible, together with more detailed error codes and messages where appropriate.

Errors should usually be logged using Winston, which will be available to the module from the core by importing  frm core (which will have configured it and set it up).

For example

```
import log from '@/lib/app-logger'

log.warn('Me Too')
```

### Dependencies

dependencies and their conflicts will be handled manually.  The goal of modularity is not to allow completely independent development, but to stop AI systems from clobbering the core application with module specific code.

### Lifecycle.

Load at the beginning and Unload at the end.  The API call registerModule() will take a registration and a deregistration funtion.

### Intermodule communication

Not permitted

### Security

Currently there are no restrictions on module data access.  This is because the current goal of the system is *not* to allow external developers to implement independent modules, but to provide a framework so that we can specify what files AI mayy or may not touch while developing a new feature.

Modules should implement their own user level authorization protocols.

### Versioning

TBD

### Development Scaffolding

```
frontend/modules/xxx/config.ts
frontend/modules/xxx/dashboard/index.tsx // plus maybe more components etc.
frontend/modules/xxx/lib/api-hooks.ts

frontend/components/dashboard/xxx/  // top-half code for the module xxx includes registering the tab, maybe other things TBD

backend/src/modules/xxx/config.ts   // optional config will be set up in registration
backend/src/modules/xxx/routes/index.ts  // plus maybe other files incorporated into index.ts
backend/src/modules/xxx/services/xService1.ts // maybe several services
backend/src/modules/xxx/index.ts // sets up config, registers the module with core 
...



### Configuration

Modules can access their own configuratin which is run during module initialization.  They can also access core system config by importing it.

### Documentation

TBD

### Shared Components Access

There are currently no restrictions on which part of the core system modules can access.

### Performance

Modules should be separated into front-ends and back-ends to speed initial load.


