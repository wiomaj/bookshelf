// Login is no longer needed — redirect to home.
import { redirect } from 'next/navigation'

export default function LoginPage() {
  redirect('/')
}
