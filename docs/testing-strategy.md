# Comprehensive Testing Strategy

## Backend
- Unit and integration tests are located in `backend/test/`.
- Use `npm test` or `yarn test` in the backend directory to run all tests.
- Add new tests for each handler, utility, and integration point.
- Aim for high coverage of business logic, error handling, and edge cases.

## Frontend
- Uses [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for React component and integration tests.
- Example tests are in `frontend/src/pages/*.test.tsx`.
- Add tests for all pages, components, and hooks.
- Run all frontend tests with:
  ```sh
  cd frontend
  npm test
  ```

## CI/CD
- All tests are run automatically in the GitHub Actions pipeline on every push and PR.
- Linting is also enforced in CI.

## Recommendations
- Add tests for API error cases, edge conditions, and user flows.
- Use mocks for external APIs and network calls.
- Review and increase coverage regularly.
