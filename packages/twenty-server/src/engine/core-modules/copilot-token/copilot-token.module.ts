import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { CopilotTokenController } from 'src/engine/core-modules/copilot-token/copilot-token.controller';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [TokenModule, WorkspaceCacheStorageModule],
  controllers: [CopilotTokenController],
  providers: [JwtAuthGuard, WorkspaceAuthGuard],
})
export class CopilotTokenModule {}
