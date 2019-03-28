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
ReadPostRequestContent,
CreatePostRequestContent,
CreatePostResponseContent} from 'influencers-service-bus';
import * as globalModels from 'influencers-models';
import 'dotenv/config';

var init = false;
var run = true;
var processItem = true;
const name = 'backgroundService_poster';


(async () => {
    while(run) {
        if (!init) {
            await MessagingService.init();
            init = true;
        }
        try
        {
            //Lectura del ad pendiente de crear sus post         
            let ad = await getAd();
            if (ad === null) {
                console.log('nada que leer por el momento');
                processItem = false;
            } else { processItem = true;}

            //#region Post creation
            if (processItem) {
                ad[globalModels.advertisementFields.socialMediaTarget].forEach(async (platform) => {
                
                    if (!await verifyExist(ad._id, platform)) {
                        let adUpdated = {entity: ad, ok: true, detail: null};
                        if(platform !== "Facebook") {
                            adUpdated = await changeStatusPlatform(ad._id, platform, "Posting");
                        }
                        
                        console.log(adUpdated);
                        if (adUpdated.entity !== null) {
                            let postInSocialMedia = await createPostInSocialMedia(adUpdated, platform);
                            console.log(postInSocialMedia);
                            switch (postInSocialMedia.status) {
                                case "Posted":
                                    await createPostInBD(adUpdated.entity, platform, postInSocialMedia.postPlatformId);
                                    await changeStatusPlatform(ad._id, platform, "Posted");
                                break;
                                case "Failed":
                                    await changeStatusPlatform(adUpdated.entity._id, platform, "Failed"); 
                                break;
                                case "Removed":
                                    await changeStatusPlatform(adUpdated.entity._id, platform, "Removed"); 
                                break;
                                default:
                                    break;
                            }
                        }
                    }
                    
                 });
            }
            
            
        }
        catch (err)
        {
            console.log('se rompo', err);
            run = false;
        }
    }

})();


async function createPostInSocialMedia(advertisement, platform) {
    console.log('llega hasta aca');
    var row = new CreatePostRequestContent(advertisement);

    var requestSocialMediaPost = new SocialMediaRequestPayload(platform, row);

    console.log(requestSocialMediaPost);
    var responseSocialMedia : SocialMediaRequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.SOCIALMEDIA, RequestEnum.SocialMedia_Request.CREATE_POST), requestSocialMediaPost));
    console.log(responseSocialMedia);

    return  {status: "Posted", postPlatformId: (responseSocialMedia.payload as CreatePostResponseContent).postPlatformId};

}

async function createPostInBD(ad, platform, postPlatformId) {
    var request = new RequestPayload();
    await request.init(globalModels.Model.post, null, null, {
        [globalModels.postFields.advertisementId]: ad._id,
        [globalModels.postFields.campaignId]: ad[globalModels.advertisementFields.campaignId],
        [globalModels.postFields.companyId]: ad[globalModels.advertisementFields.companyId],
        [globalModels.postFields.platform]: platform,
        [globalModels.postFields.postPlatformId]: postPlatformId,

    }, null, null, null, null);

    var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.CREATE), request));

    console.log(`Nuevo Post ${response.entity._id}`);
}

async function changeStatusPlatform(adId, platform, platformStatus) {
    try{
        var request = new RequestPayload();
        var platformField = '';
        switch (platform.toString()) {
            case "Facebook":
            platformField = "facebookStatus";
            break;
            case "Instagram":
            platformField = "instagramStatus";
            break;
            case "Twitter":
            platformField = "twitterStatus";
            break;
            default:
            platformField = "aa";
                break;
        }
        let args = {_id: adId, [platformField]: platformStatus};
        await request.init(globalModels.Model.advertisement, null, null, args, args._id, null, null, null);

        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.UPDATE), request));

        return {entity: response.entity, ok: true, detail: null};
    }
    catch (err){
        console.log(err);
        return {entity: null, ok: false, detail: err};
    }
}

async function verifyExist(adId, platform) {
    var request = new RequestPayload();
    await request.init(globalModels.Model.post, 
        null, 
        {
            [globalModels.postFields.advertisementId]: adId,
            [globalModels.postFields.platform]: platform,
        }, null, null, null, null, null);

    var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.READ_COUNT), request));
    if (response.count && response.count > 0) return true;
    else return false;
}

async function getAd() {
    try {
        var request = new RequestPayload();
        await request.init(globalModels.Model.advertisement, null, 
        [
            new RequestWhere(RequestWhereType.EQUAL, "facebookStatus", "None"),
            new RequestWhere(RequestWhereType.EQUAL, "instagramStatus", "None"),
            new RequestWhere(RequestWhereType.EQUAL, "twitterStatus", "None"),
            new RequestWhere(RequestWhereType.NOTEQUAL , "companyId", null)
        ],
        {
            facebookStatus: "Posting"
        }, 
        null, null, null, null, ["creationDt"], true);
        var response : RequestResponse = Object.assign(await MessagingService.request(name, await formatRequest(Source.STORAGE, RequestEnum.DataStorage_Request.FIND_ONE_AND_UPDATE), request));
        console.log(response);
        return response.entity;
    } catch (error) {
        console.log(error);
        return null;
    }
}



