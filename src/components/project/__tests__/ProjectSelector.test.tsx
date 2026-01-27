/**
 * Tests for ProjectSelector component with Shadcn/Radix Select
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectSelector } from '../ProjectSelector'

// Mock the context module
const mockSelectProject = vi.fn()
const mockContextValue = {
  projects: [
    { id: '1', name: 'Project A', address: '123 St', owner_id: 'o1', user_count: 1, created_at: '2024-01-01' },
    { id: '2', name: 'Project B', address: null, owner_id: 'o1', user_count: 0, created_at: '2024-01-02' },
  ],
  selectedProjectId: '1',
  selectedProject: { id: '1', name: 'Project A', address: '123 St', owner_id: 'o1', user_count: 1, created_at: '2024-01-01' },
  selectProject: mockSelectProject,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
}

vi.mock('@/context/ProjectContext', () => ({
  useProject: vi.fn(() => mockContextValue),
}))

import { useProject } from '@/context/ProjectContext'

describe('ProjectSelector - populated state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useProject).mockReturnValue(mockContextValue)
  })

  it('renders select trigger with selected value', () => {
    render(<ProjectSelector />)

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('Project A')
  })

  it('shows all project options when opened', async () => {
    const user = userEvent.setup()
    render(<ProjectSelector />)

    await user.click(screen.getByRole('combobox'))

    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Project A')
    expect(options[1]).toHaveTextContent('Project B')
  })

  it('calls selectProject when option is selected', async () => {
    const user = userEvent.setup()
    render(<ProjectSelector />)

    await user.click(screen.getByRole('combobox'))

    const listbox = screen.getByRole('listbox')
    const projectB = within(listbox).getByText('Project B')
    await user.click(projectB)

    expect(mockSelectProject).toHaveBeenCalledWith('2')
  })
})

describe('ProjectSelector - loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useProject).mockReturnValue({
      ...mockContextValue,
      projects: [],
      selectedProjectId: null,
      selectedProject: null,
      isLoading: true,
      error: null,
    })
  })

  it('shows loading indicator', () => {
    render(<ProjectSelector />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('does not render select during loading', () => {
    render(<ProjectSelector />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('ProjectSelector - error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useProject).mockReturnValue({
      ...mockContextValue,
      projects: [],
      selectedProjectId: null,
      selectedProject: null,
      isLoading: false,
      error: 'Failed to load',
    })
  })

  it('shows error message', () => {
    render(<ProjectSelector />)

    expect(screen.getByText(/failed to load projects/i)).toBeInTheDocument()
  })

  it('shows error in title attribute', () => {
    render(<ProjectSelector />)

    const errorElement = screen.getByText(/failed to load projects/i)
    expect(errorElement).toHaveAttribute('title', 'Failed to load')
  })

  it('does not render select on error', () => {
    render(<ProjectSelector />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('ProjectSelector - empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useProject).mockReturnValue({
      ...mockContextValue,
      projects: [],
      selectedProjectId: null,
      selectedProject: null,
      isLoading: false,
      error: null,
    })
  })

  it('shows empty message when no projects', () => {
    render(<ProjectSelector />)

    expect(screen.getByText(/no projects available/i)).toBeInTheDocument()
  })

  it('does not render select when empty', () => {
    render(<ProjectSelector />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('ProjectSelector - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles null selectedProjectId with placeholder', () => {
    vi.mocked(useProject).mockReturnValue({
      ...mockContextValue,
      selectedProjectId: null,
      selectedProject: null,
    })

    render(<ProjectSelector />)

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('Select project')
  })

  it('renders correct options in listbox', async () => {
    vi.mocked(useProject).mockReturnValue(mockContextValue)
    const user = userEvent.setup()

    render(<ProjectSelector />)
    await user.click(screen.getByRole('combobox'))

    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options[0]).toHaveTextContent('Project A')
    expect(options[1]).toHaveTextContent('Project B')
  })
})
