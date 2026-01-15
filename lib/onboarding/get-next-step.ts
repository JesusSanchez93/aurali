export function getAllowedStep(status: string) {
  switch (status) {
    case 'step1_completed':
      return '/onboarding/step2';
    case 'step2_completed':
      return '/onboarding/step3';
    case 'finish':
      return '/onboarding/completed';
    default:
      return '/onboarding/step1';
  }
}
