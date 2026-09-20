'use client';

import { createContext, useContext, useMemo } from 'react';
import type { SessionProfile } from '@/lib/auth/get-session-profile';

const ProfileContext = createContext<SessionProfile | null>(null);

export default function ProfileProvider({
  profile,
  children,
}: {
  profile: SessionProfile;
  children: React.ReactNode;
}) {
  const value = useMemo(() => profile, [profile]);
  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
};
