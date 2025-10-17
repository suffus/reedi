# Facets and Permissions

In order to build a comprehensive permissions system for our product, we shall give every entity on our system one or more facets.  We can then build predicates over these facets to determine whether an agent (X) can perform an operation (Y) on one or more particular entity/ies (Z).

## Facets

For example, a user (X) can view (Y) a media-itemm image (Z) iff (a) Z has the facet "view-restrictions:PUBLIC", (b) Z has the facet "view-restrictions:FRIENDS" and X is a friend of the Owner of Z, (c) if X is the owner of Z, (d) if X is a manager of the owner of Z, (e) X has the facet "reedi-admin-level:global", (f) X has the facet "reedi-admin-level:divisional" and the "division" facet of X and the owner of Z are the same.

To implement this, we need a way of applying sets of facets to entities.  We already have a way of doing essentially exactly this with tags, so we should essentially replicate what we have there but for security reasons I don't want to actually use tags so we don't have to security audit every method that uses them.  In general then a facet "tag" will have the format "facet-scope:facet-name:facet-value".  The facet-scope is there to allow us to apply different facets in different contexts.  The main differnces between a facet and a tag are: (a) for certain facets, the history of all facet assignments must be recorded (who assigned the facet to whom, when and why), (b) some facets may expire or require regular review

## Permissions

In contrast to a facet which describes what an entity is (or which groups it belongs to, or what its role is), a permission describes what some agent can do to what, in what scopes.  Generally facets apply to agents and entities.  Permissions apply to **operations**.

For example, media-read(C,X,Z) will be true iff X has permission to read media item Z in context C.  For higher level permissions, assign-facet(C,X1,X2,F) will be true if X1 has the capability of assigning facet F to user X2 in context C.  The assign-facet function will return a **permission** object `{"grant":<string>,"reason":<string>,"user":<id>,"item":<id>}` which will essentially give a reason for the grant (eg F was a low level facet, X1 (the request User) had "can-assign-facet:1").  In all these cases, the context (or scope) C will correspond to the JWT presented as the Bearer token to the API call (which should identify the user and the authentication used at a minimum).  

## Coding permissions

In the backend, all actions which require a permission must be accompanied by a Bearer token which will give this permission.  In order to write the permissions functions without repetition, and so that they may be audited and protected, the required permissions used throughout a module will be analyzed and separated out into a separate file (one for each route module) which will sit under `src/auth`.  The route module will include the functions it requires from its auth file and execute them to deny or filter responses.   

### Example - media files

The route `/api/media/user/:user-id` return a user's media.  The media actually returned will vary depending on the visibility settings of the media, and the user who is calling the function.

Using the rules we stated above, we might define a function in `src/auth/media.ts`:

```
import {deny,grant} from '@/lib/permissions'
import {getFacet, hasFacet} from '@/lib/facets'
import {isAdministratorFor} from '@/lib/userRelations'

function canDoMediaRead(auth: Authentication, u: User, item: MediaItem) {
    const requestUser = auth.user
    if( item.visibility === "PUBLIC") {
        return grant(requestUser?.id, item.id, 'media-read', 'Item is public')
    }
    if( !requestUser ) {
        return deny(requestUser?.id, item.id, 'media-read', 'No authenticated user presented')
    }
    if(item.owner === requestUser) {
        return grant(requestUser?.id, item.id, 'media-read', 'Request user is owner')
    }
    if( requestUser.isFriendsWith(item.owner) && item.visibility==="FRIENDS") {
        return grant(requestUser?.id, item.id, 'media-read', 'Request user is friends with owner and item visibility is FRIENDS')
    }
    if( requestUser.hasFacet(requestAuthentication, 'reedi-admin:global' )) {
        return grant(requestUser?.id, item.id, 'media-read', 'Request user is a global admin')
    }
    if( requestUser.hasFacet(requestAuthentication, 'reed-admin:local') && 
        requestUser.getFacet('division') === item.owner.getFacet('division')) {
            return grant(requestUser?.id, item.id, 'media-read', 'Request user is local admin for same division as item owner')
    }
    if( requestUser.isAdministratorFor(item.owner)) {
        return grant(requestUser?.id, item.id, 'media-read', 'Request user is manager or administrator for owner')
    }
    return deny(requestUser?.id, item.id, 'media-read', 'By default')
}
```

This function would be used throughout the module whenever a decision was needed to screen media.

## Auditing permissions

In due course, all or a subset of granted permissions could be stored in a database or send to RabbitMQ for further processing or storing outside the backend.

## Auditing Facet assignment

The assignment of facets to users must be tracked in the database.  The logic of who has what authority to assign facets will be developed with the application.  For now, a user must have the 'reedi-facet-admin:global' facet to be able to assign any facet.  We shall also define more restricted rules for enabling facet assignment in due course.

### Facet lifecycle

After assignment, facets will have an expiry time, and will need to be reconfirmed by an agent and extended (or revoked).  

### Facet hierarchies

facets are naturally in a hierarchy which is a partial order, and this needs to be defined at the time they are created.  For example, a job title may be a facet, and a Devops Director may be above Devops Engineer, but there may be tests which say that everything that needs a Devops Engineer facet can also apply to a Devops Manager.  For example `user.getFacet('job-role').isAtLeast('devops-engineer')`.

# Permissions

Permissions are calculated by a piece of javascript which returns a permissions object.   These checks are explicitly called whenever a decission to serve or include an item or execute an event is to be made, therefore there should eb no permission conflicts.

## Defaults and errors

In general the permissions checker logic shoudl handle all cases.  If a case is not handled by the permissions checker logic, or if the permissions checker logic or database throws an error, the permission should not be granted and a 500 shoudl be returned to note it is an error and not a 401 or 403.

## Relationship to existing permission logic

The facet based permissions system augments but does not replace the current permission systems for groups and visibility.  It is designed to add in admin functionality, and to allow reporting hierarchies or geograhical hierarchies of corporate users to be taken into account when making permissions decisions.

## Divisions and Departments

In due course, we shall introduce models for corporate divisions (operating units) and departments (functional corporate administrative units). Currently they will be handled by facets, with users having a 'division' facet ad a 'department' facet.  These will be selected currently from the facet system but may be joined with a later corporate structure model.

## Permissions introspection

This is calculated from other information, notably facets.  So while there may be a 1-1 relationship between facets and permissions in some cases, normally this is not the case, so permissions introspection is not possible.