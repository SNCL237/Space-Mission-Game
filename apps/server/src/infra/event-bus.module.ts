import { Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { EVENT_BUS } from "@smdg/contracts";

import { BusEvenementsNest } from "./event-bus.js";

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [BusEvenementsNest, { provide: EVENT_BUS, useExisting: BusEvenementsNest }],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
