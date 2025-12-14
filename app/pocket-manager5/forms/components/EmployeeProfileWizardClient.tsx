"use client";
import dynamic from "next/dynamic";
import React from "react";

const EmployeeProfileWizard = dynamic(() => import("../../components/EmployeeProfileWizard"), { ssr: false });

export default function EmployeeProfileWizardClient(props: Record<string, unknown>) {
  return <EmployeeProfileWizard {...(props as any)} />;
}
