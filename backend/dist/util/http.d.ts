import type { APIGatewayProxyResult } from "aws-lambda";
export declare const json: (statusCode: number, body: unknown) => APIGatewayProxyResult;
export declare const bad: (msg: string, statusCode?: number) => APIGatewayProxyResult;
