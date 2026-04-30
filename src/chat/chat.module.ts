import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, forwardRef(() => RoomsModule)],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
