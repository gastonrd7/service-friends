import { MessagingService, 
    RequestPayload, 
    RequestResponse, 
    RequestEnum, 
    formatRequest, 
    Source,
    RequestWhereType,
    RequestWhere,
SocialMediaRequestPayload, 
SocialMediaRequestResponse,
RelationshipPostRequestContent,
RelationshipPostResponseContent,
} from 'influencers-service-bus';
import * as globalModels from 'influencers-models';
import * as lodash from 'lodash';
import 'dotenv/config';

var init = false;
var run = true;
var processItem = true;
const name = 'backgroundService_poster';

const relationship = {
    [globalModels.platformEnum.Facebook]: globalModels.people_relationshipEnum.FRIEND_OF,
    [globalModels.platformEnum.Instagram]: globalModels.people_relationshipEnum.FOLLOWED_BY
};


(async () => {
    while(run) {
        if (!init) {
            await MessagingService.init();
            init = true;
        }
        try
        {
            //Lectura del ad pendiente de crear sus post         
            let personCredential = await getPersonCredential();
            if (personCredential === null) {
                console.log('nada que leer por el momento');
                processItem = false;
                run = false;
            } else { processItem = true;}

            //#region Procesamiento del item
            if (processItem) {
                let friendsInSM = await getFriendsFromSM(personCredential);
                console.log(friendsInSM.length);
                let friendsInBD = await getFriendsInBD(personCredential[globalModels.person_credentialFields.personId], personCredential[globalModels.person_credentialFields.platform]);
                console.log(friendsInBD);
                let formerFriends = await getFormerFriends(friendsInSM, friendsInBD.arrayOfPlatformObjectIdentity);
                if (formerFriends.length > 0) deleteFormerFriends(formerFriends, friendsInBD);
                
                let newFriends = await getNewFriends(friendsInSM, friendsInBD.arrayOfPlatformObjectIdentity);
                if (newFriends.length > 0) {
                    createNewPersonCredentials(newFriends, personCredential[globalModels.person_credentialFields.platform]);
                    createNewPeopleRelationships(personCredential[globalModels.person_credentialFields.personId], newFriends, personCredential[globalModels.person_credentialFields.platform]);
                }

                updatePersonCredential(personCredential[globalModels.person_credentialFields._id]);
            }
        }
        catch (err)
        {
            console.log('se rompo', err);
            run = false;
        }
    }

})();

async function updatePersonCredential(personCredentialId) {
    try {
        var request = new RequestPayload();
        let args = {_id: personCredentialId, 
            [globalModels.person_credentialFields.friendsFeedStatus]: globalModels.person_credential_fiendsFeedStatusEnum.Idle,
            [globalModels.person_credentialFields.friendsFeedDt]: Date.now()}
        await request.init(globalModels.Model.person_credential, null, null, args, args._id, null, null, null);
        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.UPDATE), request));
    } catch (error) {
        throw(error);
    }
}

async function createNewPeopleRelationships(personId, newFriends, platform){
    try {
        await newFriends.forEach(async platformObjectIdentity => {
            if(!await existPeopleRelationship(personId, platformObjectIdentity, platform)){
                createNewPeopleRelationship(personId, platformObjectIdentity, platform);
            }
        });
    } catch (error) {
        throw(error);
    }
}

async function createNewPeopleRelationship(personId, platformObjectIdentity, platform){
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.people_relationship, null, null, {
            [globalModels.people_relationshipFields.personId]: personId,
            [globalModels.people_relationshipFields.platform]: platform,
            [globalModels.people_relationshipFields.platformObjectIdentity]: platformObjectIdentity,
            [globalModels.people_relationshipFields.relationship]: relationship[platform],

        }, null, null, null, null);

        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.CREATE), request));
    } catch (error) {
        throw(error);
    }
}

async function existPeopleRelationship(personId, platformObjectIdentity, platform){
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.people_relationship, 
            null, 
            [
                new RequestWhere(RequestWhereType.EQUAL, globalModels.people_relationshipFields.personId, personId),
                new RequestWhere(RequestWhereType.EQUAL, globalModels.people_relationshipFields.platform, platform),
                new RequestWhere(RequestWhereType.EQUAL, globalModels.people_relationshipFields.platformObjectIdentity, platformObjectIdentity),
                new RequestWhere(RequestWhereType.EQUAL, globalModels.people_relationshipFields.relationship , relationship[platform]),
            ]
            , null, null, null, null, null);

        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.READ_COUNT), request));
        if (response.count && response.count > 0) return true;
        else return false;
    } catch (error) {
        throw(error);
    }
}

async function createNewPersonCredentials(newFriends, platform){
    try {
        await newFriends.forEach(async platformObjectIdentity => {
            if(!await existPersonCredential(platformObjectIdentity, platform)){
                createNewPersonCredential(platformObjectIdentity, platform);
            }
        });
    } catch (error) {
        throw(error);
    }
}

async function createNewPersonCredential(platformObjectIdentity, platform) {
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.person_credential, null, null, {
            [globalModels.person_credentialFields.personId]: null,
            [globalModels.person_credentialFields.platform]: platform,
            [globalModels.person_credentialFields.platformObjectIdentity]: platformObjectIdentity,
            [globalModels.person_credentialFields.status]: globalModels.person_credential_statusEnum.NOT_LINKED,

        }, null, null, null, null);

        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.CREATE), request));
    } catch (error) {
        throw(error);
    }
}

async function existPersonCredential(platformObjectIdentity, platform) {
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.person_credential, 
            null, 
            [
                new RequestWhere(RequestWhereType.EQUAL, globalModels.person_credentialFields.platform, platform),
                new RequestWhere(RequestWhereType.EQUAL, globalModels.person_credentialFields.platformObjectIdentity, platformObjectIdentity),
            ]
            , null, null, null, null, null);

        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.READ_COUNT), request));
        if (response.count && response.count > 0) return true;
        else return false;
    } catch (error) {
        throw(error);
    }
}

async function getNewFriends(friendsInSM, friendsInBD) {
    try {
        return await lodash.differenceBy(friendsInSM, friendsInBD);
    } catch (error) {
        throw(error);
    }
}

async function deleteFormerFriends(formerFriends, friendsInBD) {
    try {
        await formerFriends.forEach(async formerFriend => {
            let row = await friendsInBD.rows.filter(item => item.platformObjectIdentity === formerFriend)[0];
            console.log(row[globalModels.people_relationshipFields._id]);
            var requestRemove = new RequestPayload();
            await requestRemove.init(globalModels.Model.people_relationship, null, null, null, row[globalModels.people_relationshipFields._id], null, null, null);
            await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.REMOVE), requestRemove);
        });
    } catch (error) {
        throw(error);
    }
}

async function getFormerFriends(friendsInSM, friendsInBD) {
    try {
        return await lodash.differenceBy(friendsInBD, friendsInSM);
    } catch (error) {
        throw(error);
    }
}

async function getFriendsInBD(personId, platform) {
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.people_relationship, [globalModels.people_relationshipFields._id, globalModels.people_relationshipFields.platformObjectIdentity], 
        [
            new RequestWhere(RequestWhereType.EQUAL, globalModels.people_relationshipFields.personId, personId),
            new RequestWhere(RequestWhereType.EQUAL, globalModels.people_relationshipFields.platform , platform),
        ],
        null, null, null, null, null);
        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.READ_MANY), request));

        var arrayOfPlatformObjectIdentity = await response.entities.reduce((collection, item) => {
                collection.push( item.platformObjectIdentity );
            return collection;
        }, []);
        return {arrayOfPlatformObjectIdentity, rows: response.entities};
    } catch (error) {
        throw(error);
    }
}

async function getFriendsFromSM(personCredential) {
    try {
        var row = new RelationshipPostRequestContent(personCredential);
        var requestRelationship = new SocialMediaRequestPayload(personCredential.platform, row);
        var responseRelationship : SocialMediaRequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.SOCIALMEDIA, RequestEnum.SocialMedia_Request.READ_RELATIONSHIP), requestRelationship));
        return  (responseRelationship.payload as RelationshipPostResponseContent).platformObjectIdentities;
    } catch (error) {
        throw(error);
    }
}

async function getPersonCredential() {
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.person_credential, null, 
        [
            new RequestWhere(RequestWhereType.LESSOREQUALTHAN, globalModels.person_credentialFields.friendsFeedDt,  await (Date.now() - 5 * (60 * 1000))),
            new RequestWhere(RequestWhereType.EQUAL, globalModels.person_credentialFields.friendsFeedStatus, globalModels.person_credential_fiendsFeedStatusEnum.Idle),
            new RequestWhere(RequestWhereType.NOTEQUAL , globalModels.person_credentialFields.personId, null)
        ],
        {
            [globalModels.person_credentialFields.friendsFeedStatus]: globalModels.person_credential_fiendsFeedStatusEnum.Fetching
        }, 
        null, null, null, null, [globalModels.person_credentialFields.creationDt], true);
        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.FIND_ONE_AND_UPDATE), request));
        console.log(response);
        return response.entity;
    } catch (error) {
        throw(error);
    }
}



