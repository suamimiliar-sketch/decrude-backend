import { Controller, Post, Body } from '@nestjs/common';
import { GenerationService } from './generation.service';

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('generate')
  async generate(
    @Body('orderId') orderId: string,
    @Body('themeId') themeId: string,
  ) {
    return this.generationService.generateChristmasPhoto(orderId, themeId);
  }
}