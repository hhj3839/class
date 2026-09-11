// Only return fixed messages. Provider messages can contain request or account data.
export function coachingApiError(status,body){
  const code=body?.error?.code,type=body?.error?.type;
  if(code==='insufficient_quota'||type==='insufficient_quota'||['billing_hard_limit_reached','billing_limit_reached','organization_usage_limit_exceeded'].includes(code))return new Error('OpenAI API 잔액 또는 사용 할당량이 부족합니다. API 결제·사용 한도를 확인해 주세요. 기다리거나 앱의 생성 한도를 늘려도 해결되지 않습니다.');
  if(code==='rate_limit_exceeded')return new Error('OpenAI API의 일시적인 요청량 한도에 도달했습니다. 잠시 기다린 뒤 한 번만 다시 시도해 주세요.');
  if(status===429)return new Error('OpenAI API가 요청을 제한했습니다. 잔액·사용 한도 또는 일시적인 요청 제한일 수 있어 현재 응답만으로 구분할 수 없습니다. 반복 생성은 피해주세요.');
  if(status===401)return new Error('서버의 OpenAI API 인증에 실패했습니다. 담당자가 API 키 설정을 확인해야 합니다.');
  if(status===403||code==='model_not_found')return new Error('서버의 OpenAI 모델·프로젝트 접근 권한을 확인해야 합니다.');
  if(status>=500)return new Error('외부 AI 서비스에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  return new Error('AI 코칭 생성 요청에 실패했습니다. 담당자가 서버 요청 설정을 확인해야 합니다.');
}
