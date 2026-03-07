/**
 * Not found page for unmatched routes.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

export const NotFoundPage: FC = () => {
  return (
    <>
      <title>Page Not Found | WOW Threat</title>
      <Card className="bg-panel shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Page not found</CardTitle>
          <CardDescription>The requested route does not exist.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link to="/">Return home</Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
