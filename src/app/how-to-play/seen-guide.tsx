"use client";

import { useEffect } from "react";
import { markGuideSeen } from "@/app/squad/guide-prompt";

/** Opening How to play counts as having seen it, so the squad page stops suggesting it. */
export default function SeenGuide() {
  useEffect(markGuideSeen, []);
  return null;
}
