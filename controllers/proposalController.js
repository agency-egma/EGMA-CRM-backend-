import Proposal from '../models/Proposal.js';
import Project from '../models/Project.js';
import asyncHandler from '../utils/asyncHandler.js';
import ErrorResponse from '../utils/errorResponse.js';
import { generateProposalDOC } from '../utils/proposalDocGenerator.js';

// @desc    Get all proposals
// @route   GET /api/proposals
// @access  Private
export const getProposals = async (req, res, next) => {
  const proposals = await Proposal.find().sort('-createdAt');
  
  res.status(200).json({
    success: true,
    count: proposals.length,
    data: proposals
  });
};

// @desc    Get single proposal
// @route   GET /api/proposals/:id
// @access  Private
export const getProposal = async (req, res, next) => {
  const proposal = await Proposal.findById(req.params.id);
  
  if (!proposal) {
    return next(new ErrorResponse(`Proposal not found with id of ${req.params.id}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: proposal
  });
};

/**
 * @desc    Create a new proposal
 * @route   POST /api/proposals
 * @access  Private
 */
export const createProposal = asyncHandler(async (req, res, next) => {
  // Handle empty projectId properly
  if (req.body.projectId === '') {
    delete req.body.projectId;
  }

  // Create the proposal
  const proposal = await Proposal.create(req.body);

  // If projectId is provided and valid, update the project with the proposalId
  if (proposal.projectId) {
    try {
      // Map proposal status to project proposal status
      const mapStatus = (proposalStatus) => {
        switch(proposalStatus) {
          case 'sent': return 'sent';
          case 'accepted': return 'accepted';
          case 'rejected': return 'rejected';
          case 'negotiating': return 'needs_revision';
          default: return 'not_sent';
        }
      };

      // Find the project and update it with the new proposal ID and status
      await Project.findByIdAndUpdate(
        proposal.projectId,
        {
          proposal: {
            id: proposal._id,
            status: mapStatus(proposal.status),
            sentDate: proposal.sentDate
          }
        },
        { new: true }
      );
      console.log(`Project ${proposal.projectId} updated with proposal ${proposal._id}`);
    } catch (error) {
      console.error(`Error updating project with proposal ID: ${error.message}`);
      // Continue execution even if project update fails
    }
  }

  res.status(201).json({
    success: true,
    data: proposal
  });
});

/**
 * @desc    Update a proposal
 * @route   PUT /api/proposals/:id
 * @access  Private
 */
export const updateProposal = asyncHandler(async (req, res, next) => {
  // Get the original proposal to check for projectId changes
  const originalProposal = await Proposal.findById(req.params.id);
  if (!originalProposal) {
    return next(new ErrorResponse(`Proposal not found with id of ${req.params.id}`, 404));
  }

  // Handle empty projectId properly
  if (req.body.projectId === '') {
    delete req.body.projectId;
  }

  // Update the proposal
  const proposal = await Proposal.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  // Map proposal status to project proposal status
  const mapStatus = (proposalStatus) => {
    switch(proposalStatus) {
      case 'sent': return 'sent';
      case 'accepted': return 'accepted';
      case 'rejected': return 'rejected';
      case 'negotiating': return 'needs_revision';
      default: return 'not_sent';
    }
  };

  // Handle project associations
  if (proposal.projectId) {
    // If projectId exists or changed, update the project
    if (!originalProposal.projectId || originalProposal.projectId.toString() !== proposal.projectId.toString()) {
      try {
        // Update the new project with this proposal ID and status
        await Project.findByIdAndUpdate(
          proposal.projectId,
          {
            proposal: {
              id: proposal._id,
              status: mapStatus(proposal.status),
              sentDate: proposal.sentDate
            }
          },
          { new: true }
        );
        console.log(`Project ${proposal.projectId} updated with proposal ${proposal._id}`);
      } catch (error) {
        console.error(`Error updating project with proposal ID: ${error.message}`);
      }
    } else if (proposal.status !== originalProposal.status || proposal.sentDate !== originalProposal.sentDate) {
      // If status or sentDate changed but project is the same, update project's proposal status
      try {
        await Project.findByIdAndUpdate(
          proposal.projectId,
          {
            'proposal.status': mapStatus(proposal.status),
            'proposal.sentDate': proposal.sentDate
          },
          { new: true }
        );
        console.log(`Updated proposal status in project ${proposal.projectId}`);
      } catch (error) {
        console.error(`Error updating proposal status in project: ${error.message}`);
      }
    }
  }

  // If projectId was removed or changed, remove the reference from the old project
  if (originalProposal.projectId && 
      (!proposal.projectId || originalProposal.projectId.toString() !== proposal.projectId.toString())) {
    try {
      // Find the old project and remove the proposal ID reference
      const oldProject = await Project.findById(originalProposal.projectId);
      if (oldProject && oldProject.proposal && oldProject.proposal.id && 
          oldProject.proposal.id.toString() === proposal._id.toString()) {
        await Project.findByIdAndUpdate(
          originalProposal.projectId,
          { $unset: { proposal: "" } },
          { new: true }
        );
        console.log(`Removed proposal reference from project ${originalProposal.projectId}`);
      }
    } catch (error) {
      console.error(`Error removing proposal reference from old project: ${error.message}`);
    }
  }

  res.status(200).json({
    success: true,
    data: proposal
  });
});

/**
 * @desc    Link proposal to project
 * @route   POST /api/proposals/:id/link-project/:projectId
 * @access  Private
 */
export const linkProposalToProject = asyncHandler(async (req, res, next) => {
  const proposalId = req.params.id;
  const projectId = req.params.projectId;

  // Find the proposal
  const proposal = await Proposal.findById(proposalId);
  if (!proposal) {
    return next(new ErrorResponse(`Proposal not found with id of ${proposalId}`, 404));
  }

  // Find the project
  const project = await Project.findById(projectId);
  if (!project) {
    return next(new ErrorResponse(`Project not found with id of ${projectId}`, 404));
  }

  // Update proposal with project ID
  proposal.projectId = projectId;
  await proposal.save();

  // Map proposal status to project proposal status
  const mapStatus = (proposalStatus) => {
    switch(proposalStatus) {
      case 'sent': return 'sent';
      case 'accepted': return 'accepted';
      case 'rejected': return 'rejected';
      case 'negotiating': return 'needs_revision';
      default: return 'not_sent';
    }
  };

  // Update project with proposal ID and status
  project.proposal = {
    id: proposalId,
    status: mapStatus(proposal.status),
    sentDate: proposal.sentDate
  };
  
  await project.save();

  res.status(200).json({
    success: true,
    message: `Proposal ${proposalId} linked to project ${projectId}`,
    data: {
      proposal,
      project
    }
  });
});

/**
 * @desc    Change proposal status
 * @route   PATCH /api/proposals/:id/status
 * @access  Private
 */
export const changeProposalStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  
  if (!status) {
    return next(new ErrorResponse('Please provide a status', 400));
  }
  
  // Get current proposal
  const proposal = await Proposal.findById(req.params.id);
  if (!proposal) {
    return next(new ErrorResponse(`Proposal not found with id of ${req.params.id}`, 404));
  }

  // Update sentDate if status is changing to 'sent' for the first time
  let updateData = { status };
  if (status === 'sent' && proposal.status !== 'sent' && !proposal.sentDate) {
    updateData.sentDate = new Date();
  }
  
  // Update proposal status
  const updatedProposal = await Proposal.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );
  
  // Map proposal status to project proposal status
  const mapStatus = (proposalStatus) => {
    switch(proposalStatus) {
      case 'sent': return 'sent';
      case 'accepted': return 'accepted';
      case 'rejected': return 'rejected';
      case 'negotiating': return 'needs_revision';
      default: return 'not_sent';
    }
  };
  
  // If the proposal is linked to a project, update the project's proposal status as well
  if (proposal.projectId) {
    try {
      const projectStatus = mapStatus(status);
                          
      await Project.findByIdAndUpdate(
        proposal.projectId,
        { 
          'proposal.status': projectStatus,
          ...(updateData.sentDate && { 'proposal.sentDate': updateData.sentDate })
        },
        { new: true }
      );
      
      console.log(`Updated proposal status in project ${proposal.projectId}`);
    } catch (error) {
      console.error(`Error updating proposal status in project: ${error.message}`);
    }
  }
  
  res.status(200).json({
    success: true,
    data: updatedProposal
  });
});

// @desc    Delete proposal
// @route   DELETE /api/proposals/:id
// @access  Private
export const deleteProposal = async (req, res, next) => {
  const proposal = await Proposal.findById(req.params.id);
  
  if (!proposal) {
    return next(new ErrorResponse(`Proposal not found with id of ${req.params.id}`, 404));
  }
  
  await proposal.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
};

// @desc    Generate and download proposal as Word document (DOCX)
// @route   GET /api/proposals/:id/docx
// @access  Private
export const downloadProposalDOCX = async (req, res, next) => {
  const proposal = await Proposal.findById(req.params.id);
  
  if (!proposal) {
    return next(new ErrorResponse(`Proposal not found with id of ${req.params.id}`, 404));
  }
  
  const buffer = await generateProposalDOC(proposal);
  
  res.setHeader('Content-Disposition', `attachment; filename="Proposal-${proposal._id}.docx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.send(buffer);
};
