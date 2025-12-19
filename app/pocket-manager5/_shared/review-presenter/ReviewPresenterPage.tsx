// Main Review Presenter Page Component

import React from 'react';
import { ReviewPresenterShell } from './ReviewPresenterShell';
import { ScopeType } from './types';

interface ReviewPresenterPageProps {
  mode: ScopeType;
}

export function ReviewPresenterPage({ mode }: ReviewPresenterPageProps) {
  return <ReviewPresenterShell mode={mode} />;
}