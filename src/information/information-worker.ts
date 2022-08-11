import { NestFactory } from '@nestjs/core';
import InformationModule from './information.module';
import InformationService from './information.service';
import { Logger } from '@nestjs/common';
import { sleep } from '../helper/tool';

let service = null;
async function bootstrap() {
    const app = await NestFactory.create(InformationModule);
    service = app.select(InformationModule).get(InformationService);

    process.on("message", async ({ event, data }) => {
        if (event === "refetch") {
            Logger.debug("[InformationWorker] Start refetching anime information from Anilist");
            const trackingAnime = await service.refetchAnime();
            process.send({
                event: "refetch",
                data: trackingAnime
            });
        } else if (event === "resync") {
            Logger.debug("[InformationWorker] Start resyncing anime information from Anilist to other information providers");
            const trackingAnime = await service.resyncAnime(data);
            process.send({
                event: "resync",
                data: trackingAnime
            });
        } else if (event === "fetch-specific") {
            Logger.debug("[InformationWorker] Start fetching a specific anime under administrator's request");
            const updatedAnimeId = await service.fetchAnimeByAnilistID(data);
            process.send({
                event: "fetch-specific",
                data: updatedAnimeId
            });
        } else if (event === "fetch-specific-batch") {
            Logger.debug("[InformationWorker] Start fetching a batch of specific anime under administrator's request");
            const updatedAnimeIds = [];

            for (let animeId of data) {
                const updatedAnimeId = await service.fetchAnimeByAnilistID(animeId);
                await sleep(1000);

                updatedAnimeIds.push(updatedAnimeId);
            }
            process.send({
                event: "fetch-specific-batch",
                data: updatedAnimeIds
            });
        } else if (event === "fetch-relation") {
            Logger.debug("[InformationWorker] Start fetching relations for anime");
            const ids = Array.isArray(data) ? data : [data];

            for (let id of ids) {
                await service.fetchRelations(id);
                await sleep(1000);
            }

            process.send({
                event: "fetch-relation",
                data: ids
            });
        }
    });
}
bootstrap();