export function getAllowedStep(status: string) {
  switch (status) {
    case 'step1_completed':
      return '/onboarding/step2';
    case 'step2_completed':
      return '/onboarding/step3';
    case 'step3_completed':
      return '/onboarding/step4';
    case 'step4_completed':
      return '/onboarding/workflow-selection';
    case 'completed':
      return '/dashboard';
    default:
      return '/onboarding/step1';
  }
}
