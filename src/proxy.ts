import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("placeholder")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();

  // 1. Route Protection: Redirect unauthenticated users
  if (!user) {
    if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/guest")) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. Role-Based Access Control (RBAC)
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    // Prevent Guests from accessing Admin pages
    if (url.pathname.startsWith("/admin") && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      url.pathname = "/guest/dashboard";
      return NextResponse.redirect(url);
    }

    // Prevent Admins from accessing Guest dashboard
    if (url.pathname.startsWith("/guest") && (role === "ADMIN" || role === "SUPER_ADMIN")) {
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }

    // Redirect logged-in users away from auth pages
    if (url.pathname === "/login" || url.pathname === "/register") {
      if (role === "ADMIN" || role === "SUPER_ADMIN") {
        url.pathname = "/admin/dashboard";
      } else {
        url.pathname = "/guest/dashboard";
      }
      return NextResponse.redirect(url);
    }
  } catch (err) {
    // If profiles query fails, let request proceed as a fallback
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
