import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';

import { createCopilotToken } from '@onpilot/node';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthWorkspaceMemberId } from 'src/engine/decorators/auth/auth-workspace-member-id.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Controller('api/chat-token')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class CopilotTokenController {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  @Get()
  generateToken(
    @AuthUser() user: UserEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string,
  ): { token: string } {
    const token = createCopilotToken({
      secret: this.twentyConfigService.get('COPILOT_SECRET_KEY'),
      userId: workspaceMemberId,
      orgId: workspace.id,
      role: user.canImpersonate || user.canAccessFullAdminPanel
        ? 'admin'
        : 'user',
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      email: user.email,
    });

    return { token };
  }
}
