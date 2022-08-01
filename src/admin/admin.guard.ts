import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers["x-api-key"];
        if (!apiKey) return false;

        return apiKey === process.env.ADMIN_KEY;
    }
}