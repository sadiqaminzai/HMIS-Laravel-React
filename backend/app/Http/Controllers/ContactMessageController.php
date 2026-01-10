<?php

namespace App\Http\Controllers;

use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContactMessageController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'hospital_id' => ['nullable', 'integer', 'exists:hospitals,id'],
        ]);

        $message = ContactMessage::create($data);

        return response()->json($message, 201);
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = ContactMessage::query();

        if ($user->role !== 'super_admin' && $user->hospital_id) {
            $query->where('hospital_id', $user->hospital_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%");
            });
        }

        return response()->json($query->latest()->paginate(25));
    }

    public function show(ContactMessage $contactMessage, Request $request)
    {
        if (!$this->canAccess($request->user(), $contactMessage)) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        return response()->json($contactMessage);
    }

    public function update(Request $request, ContactMessage $contactMessage)
    {
        if (!$this->canAccess($request->user(), $contactMessage)) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        $data = $request->validate([
            'status' => ['required', Rule::in(['unread', 'read', 'responded'])],
        ]);

        $contactMessage->update($data);

        return response()->json($contactMessage->fresh());
    }

    public function destroy(ContactMessage $contactMessage, Request $request)
    {
        if (!$this->canAccess($request->user(), $contactMessage)) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        $contactMessage->delete();

        return response()->json(['message' => 'Contact message deleted']);
    }

    private function canAccess($user, ContactMessage $message): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        if ($user->hospital_id === null) {
            return false;
        }

        return $message->hospital_id === null || $message->hospital_id === $user->hospital_id;
    }
}
