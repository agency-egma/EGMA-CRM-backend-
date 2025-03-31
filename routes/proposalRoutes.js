import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import {
  getProposals,
  getProposal,
  createProposal,
  updateProposal,
  deleteProposal,
  downloadProposalDOCX
} from '../controllers/proposalController.js';

const router = express.Router();

// Get all proposals and create a new proposal
router.route('/')
  .get(asyncHandler(getProposals))
  .post(asyncHandler(createProposal));

// Get, update and delete a specific proposal
router.route('/:id')
  .get(asyncHandler(getProposal))
  .put(asyncHandler(updateProposal))
  .delete(asyncHandler(deleteProposal));



// Generate and download proposal as Word document (DOCX)
router.get('/:id/docx', asyncHandler(downloadProposalDOCX));

export default router;
