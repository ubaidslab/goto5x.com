import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { NavigationLocation } from "@prisma/client";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateNavigationDto } from "./dto/update-navigation.dto";
import { NavigationService } from "./navigation.service";

@Controller("stores/:storeId/navigation")
@UseGuards(JwtAuthGuard)
export class NavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Get(":location")
  get(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("location") location: string,
  ) {
    return this.navigation.get(sellerId, storeId, this.assertLocation(location));
  }

  @Put(":location")
  upsert(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("location") location: string,
    @Body() dto: UpdateNavigationDto,
  ) {
    return this.navigation.upsert(sellerId, storeId, this.assertLocation(location), dto);
  }

  private assertLocation(location: string): NavigationLocation {
    if (location !== "header" && location !== "footer") {
      throw new BadRequestException('location must be "header" or "footer".');
    }
    return location;
  }
}
