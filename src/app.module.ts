import { CacheModule as NestCacheModule, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import DatabaseService from './database/database.service';
import ProxyService from './proxy/proxy.service';
import ScraperModule from './scraper/scraper.module';
import InformationModule from './information/information.module';
import HealthModule from './health/health.module';
import { BullModule } from '@nestjs/bull';
import AnimeController from './controller/anime.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerBehindProxyGuard } from './guard/throtller-behind-proxy.guard';
import ScraperService from './scraper/scraper.service';
import { EnimeCacheInterceptor } from './decorator/enime-cache.interceptor';
import EpisodeController from './controller/episode.controller';
import RecentController from './controller/recent.controller';
import DatabaseModule from './database/database.module';
import PopularController from './controller/popular.controller';
import StatsController from './controller/stats.controller';
import SourceService from './source/source.service';
import EpisodeService from './episode/episode.service';
import AdminModule from './admin/admin.module';
import ViewController from './controller/view.controller';
import SearchModule from './search/search.module';
import MappingModule from './mapping/mapping.module';
import ToolModule from './tool/tool.module';
import ProxyModule from './proxy/proxy.module';
import SourceModule from './source/source.module';
import CacheModule from './cache/cache.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot(), ConfigModule.forRoot({
    isGlobal: true
  }), DatabaseModule, CacheModule, ScheduleModule.forRoot(), ProxyModule, ToolModule, SearchModule, ScraperModule, SourceModule, InformationModule, AdminModule, HealthModule,
      MappingModule,
      BullModule.forRoot({
        redis: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD
        }
      }),
      ThrottlerModule.forRoot({
          ttl: 60,
          limit: 60,
          storage: new ThrottlerStorageRedisService({
              host: process.env.REDIS_HOST,
              port: Number(process.env.REDIS_PORT),
              password: process.env.REDIS_PASSWORD
          }),
      })
  ],
  controllers: [AppController, ViewController, AnimeController, StatsController, RecentController, EpisodeController, PopularController],
  providers: [AppService, DatabaseService, ProxyService, ScraperService, EpisodeService, SourceService,
      {
          provide: APP_GUARD,
          useClass: ThrottlerBehindProxyGuard,
      },
      {
          provide: APP_INTERCEPTOR,
          useClass: EnimeCacheInterceptor,
      }
  ]
})
export class AppModule {}
