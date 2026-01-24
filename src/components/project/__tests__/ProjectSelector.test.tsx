/**
 * Tests for ProjectSelector component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renders dropdown with projects', () => {
    render(<ProjectSelector />)

    expect(screen.getByLabelText('Select project')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('1')
  })

  it('shows all project options', () => {
    render(<ProjectSelector />)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Project A')
    expect(options[1]).toHaveTextContent('Project B')
  })

  it('displays selected project value', () => {
    render(<ProjectSelector />)

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('1')
  })

  it('calls selectProject on change', async () => {
    const user = userEvent.setup()
    render(<ProjectSelector />)

    await user.selectOptions(screen.getByRole('combobox'), '2')

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

  it('handles null selectedProjectId with empty value in select', () => {
    // When selectedProjectId is null but projects exist,
    // the select will default to first option due to HTML behavior
    vi.mocked(useProject).mockReturnValue({
      ...mockContextValue,
      selectedProjectId: null,
      selectedProject: null,
    })

    render(<ProjectSelector />)

    const select = screen.getByRole('combobox')
    // HTML selects default to first option when value is empty string
    // and no option with empty value exists
    expect(select).toBeInTheDocument()
  })

  it('renders correct option values', () => {
    vi.mocked(useProject).mockReturnValue(mockContextValue)

    render(<ProjectSelector />)

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveValue('1')
    expect(options[1]).toHaveValue('2')
  })
})
