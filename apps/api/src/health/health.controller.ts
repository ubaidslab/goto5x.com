import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { RedisService } from "../common/redis/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([this.checkDb(), this.checkRedis()]);

    if (!dbOk || !redisOk) {
      throw new ServiceUnavailableException({ db: dbOk, redis: redisOk });
    }
    return { status: "ok", db: dbOk, redis: redisOk };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
