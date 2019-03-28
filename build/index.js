"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const influencers_service_bus_1 = require("influencers-service-bus");
const globalModels = require("influencers-models");
require("dotenv/config");
var init = false;
var run = true;
var processItem = true;
const name = 'backgroundService_poster';
(() => __awaiter(this, void 0, void 0, function* () {
    while (run) {
        if (!init) {
            yield influencers_service_bus_1.MessagingService.init();
            init = true;
        }
        try {
            //Lectura del ad pendiente de crear sus post         
            let ad = yield getAd();
            if (ad === null) {
                console.log('nada que leer por el momento');
                processItem = false;
            }
            else {
                processItem = true;
            }
            //#region Post creation
            if (processItem) {
                ad[globalModels.advertisementFields.socialMediaTarget].forEach((platform) => __awaiter(this, void 0, void 0, function* () {
                    if (!(yield verifyExist(ad._id, platform))) {
                        let adUpdated = { entity: ad, ok: true, detail: null };
                        if (platform !== "Facebook") {
                            adUpdated = yield changeStatusPlatform(ad._id, platform, "Posting");
                        }
                        console.log(adUpdated);
                        if (adUpdated.entity !== null) {
                            let postInSocialMedia = yield createPostInSocialMedia(adUpdated, platform);
                            console.log(postInSocialMedia);
                            switch (postInSocialMedia.status) {
                                case "Posted":
                                    yield createPostInBD(adUpdated.entity, platform, postInSocialMedia.postPlatformId);
                                    yield changeStatusPlatform(ad._id, platform, "Posted");
                                    break;
                                case "Failed":
                                    yield changeStatusPlatform(adUpdated.entity._id, platform, "Failed");
                                    break;
                                case "Removed":
                                    yield changeStatusPlatform(adUpdated.entity._id, platform, "Removed");
                                    break;
                                default:
                                    break;
                            }
                        }
                    }
                }));
            }
        }
        catch (err) {
            console.log('se rompo', err);
            run = false;
        }
    }
}))();
function createPostInSocialMedia(advertisement, platform) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('llega hasta aca');
        var row = new influencers_service_bus_1.CreatePostRequestContent(advertisement);
        var requestSocialMediaPost = new influencers_service_bus_1.SocialMediaRequestPayload(platform, row);
        console.log(requestSocialMediaPost);
        var responseSocialMedia = Object.assign(yield influencers_service_bus_1.MessagingService.request(name, yield influencers_service_bus_1.formatRequest(influencers_service_bus_1.Source.SOCIALMEDIA, influencers_service_bus_1.RequestEnum.SocialMedia_Request.CREATE_POST), requestSocialMediaPost));
        console.log(responseSocialMedia);
        return { status: "Posted", postPlatformId: responseSocialMedia.payload.postPlatformId };
    });
}
function createPostInBD(ad, platform, postPlatformId) {
    return __awaiter(this, void 0, void 0, function* () {
        var request = new influencers_service_bus_1.RequestPayload();
        yield request.init(globalModels.Model.post, null, null, {
            [globalModels.postFields.advertisementId]: ad._id,
            [globalModels.postFields.campaignId]: ad[globalModels.advertisementFields.campaignId],
            [globalModels.postFields.companyId]: ad[globalModels.advertisementFields.companyId],
            [globalModels.postFields.platform]: platform,
            [globalModels.postFields.postPlatformId]: postPlatformId,
        }, null, null, null, null);
        var response = Object.assign(yield influencers_service_bus_1.MessagingService.request(name, yield influencers_service_bus_1.formatRequest(influencers_service_bus_1.Source.STORAGE, influencers_service_bus_1.RequestEnum.DataStorage_Request.CREATE), request));
        console.log(`Nuevo Post ${response.entity._id}`);
    });
}
function changeStatusPlatform(adId, platform, platformStatus) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            var request = new influencers_service_bus_1.RequestPayload();
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
            let args = { _id: adId, [platformField]: platformStatus };
            yield request.init(globalModels.Model.advertisement, null, null, args, args._id, null, null, null);
            var response = Object.assign(yield influencers_service_bus_1.MessagingService.request(name, yield influencers_service_bus_1.formatRequest(influencers_service_bus_1.Source.STORAGE, influencers_service_bus_1.RequestEnum.DataStorage_Request.UPDATE), request));
            return { entity: response.entity, ok: true, detail: null };
        }
        catch (err) {
            console.log(err);
            return { entity: null, ok: false, detail: err };
        }
    });
}
function verifyExist(adId, platform) {
    return __awaiter(this, void 0, void 0, function* () {
        var request = new influencers_service_bus_1.RequestPayload();
        yield request.init(globalModels.Model.post, null, {
            [globalModels.postFields.advertisementId]: adId,
            [globalModels.postFields.platform]: platform,
        }, null, null, null, null, null);
        var response = Object.assign(yield influencers_service_bus_1.MessagingService.request(name, yield influencers_service_bus_1.formatRequest(influencers_service_bus_1.Source.STORAGE, influencers_service_bus_1.RequestEnum.DataStorage_Request.READ_COUNT), request));
        if (response.count && response.count > 0)
            return true;
        else
            return false;
    });
}
function getAd() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            var request = new influencers_service_bus_1.RequestPayload();
            yield request.init(globalModels.Model.advertisement, null, [
                new influencers_service_bus_1.RequestWhere(influencers_service_bus_1.RequestWhereType.EQUAL, "facebookStatus", "None"),
                new influencers_service_bus_1.RequestWhere(influencers_service_bus_1.RequestWhereType.EQUAL, "instagramStatus", "None"),
                new influencers_service_bus_1.RequestWhere(influencers_service_bus_1.RequestWhereType.EQUAL, "twitterStatus", "None"),
                new influencers_service_bus_1.RequestWhere(influencers_service_bus_1.RequestWhereType.NOTEQUAL, "companyId", null)
            ], {
                facebookStatus: "Posting"
            }, null, null, null, null, ["creationDt"], true);
            var response = Object.assign(yield influencers_service_bus_1.MessagingService.request(name, yield influencers_service_bus_1.formatRequest(influencers_service_bus_1.Source.STORAGE, influencers_service_bus_1.RequestEnum.DataStorage_Request.FIND_ONE_AND_UPDATE), request));
            console.log(response);
            return response.entity;
        }
        catch (error) {
            console.log(error);
            return null;
        }
    });
}
//# sourceMappingURL=index.js.map