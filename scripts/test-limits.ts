import { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../api/ai-tutor';
import * as admin from '../api/_lib/firebaseAdmin';

async function mockVercelReqRes(body: any, auth: boolean = true) {
  const req = {
    method: 'POST',
    headers: {
      authorization: auth ? 'Bearer mock-token' : ''
    },
    body
  } as unknown as VercelRequest;

  let statusCode = 200;
  let responseData: any = {};

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
    }
  } as unknown as VercelResponse;

  return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function testLimits() {
  console.log('Testing missing Auth...');
  let { req, res, getResult } = await mockVercelReqRes({ question: 'hello', requestId: '123' }, false);
  await handler(req, res);
  // Expect 401
  if (getResult().statusCode === 401) console.log('Auth check passed');
  else console.error('Auth check failed', getResult());
}

testLimits().catch(console.error);
