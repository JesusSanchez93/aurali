'use client';

import { createContext, useContext } from 'react';

const ProfileContext = createContext<any>(null);

export default function ProfileProvider({
  profile,
  children,
}: {
  profile: any;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
};
