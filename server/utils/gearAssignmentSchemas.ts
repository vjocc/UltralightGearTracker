/**
 * Server-side wrapper for the Gear Assignment (P2) schemas. Re-exports
 * the shared schema + types so server endpoints can import from this
 * file (mirrors the gearSchemas / tripSchemas / tripShareSchemas pattern).
 */
export {
  assignedGearItemSchema,
  gearAssignmentParticipantSchema,
  gearAssignmentsResponseSchema,
  type AssignedGearItem,
  type GearAssignmentParticipant,
  type GearAssignmentsResponse,
} from '~/shared/gearAssignmentSchemas';
