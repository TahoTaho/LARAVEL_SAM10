<?php

namespace App\Http\Middleware;

use Closure;

class ForceJson
{
    public function handle($request, Closure $next)
    {
        // If content-type is JSON, decode it manually
        if (str_contains($request->header('Content-Type'), 'application/json')) {

            $data = json_decode($request->getContent(), true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                $request->merge($data);
            }
        }

        return $next($request);
    }
}
