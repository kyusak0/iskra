<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Message;
use App\Models\MessageRead;
use App\Models\Post;
use App\Models\Repost;
use App\Models\UserBlock;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Route;

class DebateController extends Controller
{
    public function getChats(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;

        $chats = Chat::with([
            'members',
            'owner',
            'messages' => fn($query) => $query
                ->with('source')
                ->orderBy('created_at'),

                'members',
                'messages.message',
                'messages.user',
                'messages.source',
                'messages.readers:id,name',
        ])
            ->where(function ($query) use ($userId) {
                $query->where('type', 'public')
                    ->orWhereHas('members', function ($memberQuery) use ($userId) {
                        $memberQuery->where('users.id', $userId);
                    });
            })
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $chats,
        ]);
    }

    public function getChatInfo(Request $request, $id): JsonResponse
    {
        $chat = Chat::where('id', $id)
            ->with([
                'members',
                'messages',
                'messages.user',
                'messages.message',
                'messages.source',
                'messages.readers:id,name',
                'owner',
            ])
            ->first();

        if (!$chat) {
            return response()->json([
                'success' => false,
                'message' => 'Chat not found',
            ], 404);
        }

        if ($chat->type === 'personal' && !$this->isChatMember($request->user()->id, $chat)) {
            return response()->json([
                'success' => false,
                'message' => 'Вы не состоите в этом чате.',
            ], 403);
        }

        $chat->setRelation(
            'messages',
            $this->decorateMessagesForViewer($chat->messages, $request->user(), $chat)
        );

        return response()->json([
            'success' => true,
            'data' => $chat,
        ]);
    }

    public function getChatUrl(Request $request, $url): JsonResponse
    {
        $chat = Chat::where('url', $url)
            ->with([
                'members',
                'messages',
                'messages.message',
                'messages.user',
                'messages.source',
                'messages.readers:id,name',
                'owner',
            ])
            ->first();

        if (!$chat) {
            return response()->json([
                'success' => false,
                'message' => 'Chat not found',
            ], 404);
        }

        if ($chat->type === 'personal' && !$this->isChatMember($request->user()->id, $chat)) {
            return response()->json([
                'success' => false,
                'message' => 'Вы не состоите в этом чате.',
            ], 403);
        }

        $chat->setRelation(
            'messages',
            $this->decorateMessagesForViewer($chat->messages, $request->user(), $chat)
        );

        return response()->json([
            'success' => true,
            'data' => $chat,
        ]);
    }

    public function createChat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'avatar' => 'nullable|string|max:255',
            'type' => 'required|in:public,private',
            'url' => 'required|string|max:255|unique:chats,url',
        ]);

        $user = $request->user();

        $chat = Chat::create([
            'title' => trim($validated['title']),
            'bio' => $validated['bio'] ?? null,
            'owner_id' => $user->id,
            'avatar' => $validated['avatar'] ?? null,
            'type' => $validated['type'],
            'url' => $validated['url'],
        ]);

        $chat->members()->syncWithoutDetaching([$user->id]);
        $chat->load(['members', 'owner']);

        return response()->json([
            'success' => true,
            'message' => 'Чат создан успешно',
            'data' => $chat,
        ]);
    }

    public function createChatPersonal(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'other_user_id' => 'required|integer|exists:users,id',
            'title' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $otherUserId = (int) $validated['other_user_id'];

        if ($otherUserId === (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя создать personal-чат с самим собой.',
            ], 422);
        }

        if ($this->isUserBlockedPair((int) $user->id, $otherUserId)) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя создать personal-чат: между пользователями есть блокировка.',
            ], 403);
        }

        $existingChat = Chat::where('type', 'personal')
            ->whereHas('members', function ($query) use ($user) {
                $query->where('users.id', $user->id);
            })
            ->whereHas('members', function ($query) use ($otherUserId) {
                $query->where('users.id', $otherUserId);
            })
            ->with(['members', 'owner'])
            ->first();

        if ($existingChat) {
            return response()->json([
                'success' => true,
                'data' => $existingChat,
                'isNew' => false,
            ]);
        }

        $chat = Chat::create([
            'title' => $validated['title'] ?? null,
            'owner_id' => $user->id,
            'type' => 'personal',
        ]);

        $chat->members()->syncWithoutDetaching([$user->id, $otherUserId]);
        $chat->load(['members', 'owner']);

        return response()->json([
            'success' => true,
            'message' => 'Чат создан успешно',
            'data' => $chat,
            'isNew' => true,
        ]);
    }

    public function sendMessage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'content' => 'nullable|string',
            'post_id' => 'nullable|integer',
            'video_id' => 'nullable|integer',
            'chat_id' => 'nullable|integer',
            'answer_id' => 'nullable|integer|exists:messages,id',
            'source_id' => 'nullable|integer|exists:sources,id',
        ]);

        if (blank($validated['content'] ?? null) && empty($validated['source_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Сообщение не может быть пустым.',
            ], 422);
        }

        [$messageable, $messageType] = $this->resolveMessageableFromRoute($request, $validated);
        $user = $request->user();

        if ($messageType === 'chat' && !$this->isChatMember($user->id, $messageable)) {
            return response()->json([
                'success' => false,
                'message' => 'Вы не состоите в этом чате.',
            ], 403);
        }

        if ($messageType === 'chat' && $messageable instanceof Chat && $this->isPersonalChatInteractionBlocked($messageable, (int) $user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Отправка сообщений в personal-чате недоступна из-за блокировки пользователя.',
            ], 403);
        }

        if (($messageable->commentable ?? 'true') !== 'true') {
            return response()->json([
                'success' => false,
                'message' => 'Комментарии в этой сущности отключены.',
            ], 403);
        }

        $message = $messageable->messages()->create([
            'content' => $validated['content'] ?? null,
            'author_id' => $user->id,
            'type' => $messageType,
            'answer_id' => $validated['answer_id'] ?? null,
            'source_id' => $validated['source_id'] ?? null,
        ]);

        $message = Message::with(['user', 'message', 'source', 'readers:id,name'])->findOrFail($message->id);

        if ($messageable instanceof Chat) {
            $message = $this->decorateMessageForViewer($message, $user, $this->getChatParticipantIds($messageable));
        }

        return response()->json([
            'success' => true,
            'data' => $message,
            'message' => 'success',
        ]);
    }

    public function commentable(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'post_id' => 'nullable|integer',
            'video_id' => 'nullable|integer',
            'chat_id' => 'nullable|integer',
            'commentable' => 'required|in:true,false',
        ]);

        $target = $this->resolveCommentableTarget($request, $validated);
        $user = $request->user();

        if (!$this->canManageCommentable($user, $target)) {
            return response()->json([
                'success' => false,
                'message' => 'Недостаточно прав для изменения настроек комментариев.',
            ], 403);
        }

        $target->update([
            'commentable' => $validated['commentable'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $target->fresh(),
        ]);
    }

    public function repost(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'post_id' => 'nullable|integer',
            'video_id' => 'nullable|integer',
            'link' => 'required|string|max:255',
        ]);

        if (str_contains($validated['link'], '/videos/')) {
            Video::findOrFail($validated['video_id']);
        } else {
            Post::findOrFail($validated['post_id']);
        }

        $user = $request->user();

        $existingRepost = Repost::query()
            ->where('user_id', $user->id)
            ->where('link', $validated['link'])
            ->first();

        if ($existingRepost) {
            $existingRepost->delete();

            return response()->json([
                'success' => true,
                'data' => $existingRepost,
                'message' => 'Repost removed successfully',
                'reposted' => false,
            ]);
        }

        if (str_contains($validated['link'], '/videos/')) {
            $repost = Repost::create([
            'video_id' => $validated['video_id'],
            'user_id' => $user->id,
            'link' => $validated['link'],
        ]);
        } else {
            $repost = Repost::create([
            'post_id' => $validated['post_id'],
            'user_id' => $user->id,
            'link' => $validated['link'],
        ]);
        }

        return response()->json([
            'success' => true,
            'data' => $repost,
            'message' => 'Repost created successfully',
            'reposted' => true,
        ]);
    }

    public function getMessages(Request $request, $id): JsonResponse
    {
        $uri = Route::current()->uri();

        if (str_contains($uri, 'post')) {
            $messages = Message::where('messageable_id', $id)
                ->where('messageable_type', Post::class)
                ->with(['user', 'message', 'message.user', 'source'])
                ->orderBy('created_at')
                ->get();
        } elseif (str_contains($uri, 'chat')) {
            $chat = Chat::with('members')->findOrFail($id);

            if (!$this->isChatMember($request->user()->id, $chat)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Вы не состоите в этом чате.',
                ], 403);
            }

            $messages = Message::where('messageable_id', $id)
                ->where('messageable_type', Chat::class)
                ->with(['user', 'message', 'message.user', 'source', 'readers:id,name'])
                ->orderBy('created_at')
                ->get();

            $messages = $this->decorateMessagesForViewer($messages, $request->user(), $chat);
        } else {
            $messages = Message::where('messageable_id', $id)
                ->where('messageable_type', Video::class)
                ->with(['user', 'message', 'message.user', 'source'])
                ->orderBy('created_at')
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $messages,
        ]);
    }

    public function deleteMessage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message_id' => 'nullable|integer|exists:messages,id',
            'id' => 'nullable|integer|exists:messages,id',
        ]);

        $messageId = $validated['message_id'] ?? $validated['id'] ?? null;
        $message = Message::with('messageable')->findOrFail($messageId);

        if (!$this->canManageMessage($request->user(), $message)) {
            return response()->json([
                'success' => false,
                'message' => 'Недостаточно прав для удаления сообщения.',
            ], 403);
        }

        $message->delete();

        return response()->json([
            'success' => true,
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'chat_id' => 'required|integer|exists:chats,id',
        ]);

        $chat = Chat::with('members')->findOrFail($validated['chat_id']);

        if ($chat->type === 'personal' && !$this->isChatMember($request->user()->id, $chat)) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя вступить в personal чат по ссылке.',
            ], 403);
        }

        $chat->members()->syncWithoutDetaching([$request->user()->id]);

        return response()->json([
            'success' => true,
            'data' => $chat->fresh(['members', 'owner']),
        ]);
    }

    public function pinMess(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message_id' => 'nullable|integer|exists:messages,id',
            'id' => 'nullable|integer|exists:messages,id',
            'is_pinned' => 'nullable|in:true,false',
        ]);

        $messageId = $validated['message_id'] ?? $validated['id'] ?? null;
        $message = Message::with('messageable')->findOrFail($messageId);

        if (!$this->canManageMessage($request->user(), $message)) {
            return response()->json([
                'success' => false,
                'message' => 'Недостаточно прав для закрепления сообщения.',
            ], 403);
        }

        $newPinnedState = $validated['is_pinned'] ?? ($message->is_pinned === 'true' ? 'false' : 'true');
        $message->update([
            'is_pinned' => $newPinnedState,
        ]);
        $message->load(['user', 'message', 'source']);

        return response()->json([
            'success' => true,
            'data' => $message,
        ]);
    }

    public function wsChatAccess(Request $request, $id): JsonResponse
    {
        $chat = Chat::with('members')->findOrFail($id);
        $user = $request->user();

        if (!$this->isChatMember($user->id, $chat)) {
            return response()->json([
                'success' => false,
                'message' => 'Вы не состоите в этом чате.',
            ], 403);
        }

        if ($this->isPersonalChatInteractionBlocked($chat, (int) $user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Доступ к websocket для personal-чата недоступен из-за блокировки пользователя.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'chat_id' => $chat->id,
            ],
        ]);
    }

    public function markMessagesRead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'chat_id' => 'required|integer|exists:chats,id',
            'message_ids' => 'required|array|min:1',
            'message_ids.*' => 'integer|distinct|exists:messages,id',
        ]);

        $chat = Chat::with('members')->findOrFail($validated['chat_id']);
        $user = $request->user();

        if (!$this->isChatMember($user->id, $chat)) {
            return response()->json([
                'success' => false,
                'message' => 'Вы не состоите в этом чате.',
            ], 403);
        }

        $messageIds = Message::query()
            ->whereIn('id', $validated['message_ids'])
            ->where('messageable_type', Chat::class)
            ->where('messageable_id', $chat->id)
            ->where('author_id', '!=', $user->id)
            ->pluck('id');

        if ($messageIds->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [
                    'message_ids' => [],
                    'reader_id' => $user->id,
                    'read_at' => now()->toISOString(),
                ],
            ]);
        }

        $now = now();
        $rows = $messageIds->map(function ($messageId) use ($user, $now) {
            return [
                'message_id' => $messageId,
                'user_id' => $user->id,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        })->all();

        MessageRead::query()->upsert(
            $rows,
            ['message_id', 'user_id'],
            ['read_at', 'updated_at']
        );

        return response()->json([
            'success' => true,
            'data' => [
                'message_ids' => $messageIds->values(),
                'reader_id' => $user->id,
                'read_at' => $now->toISOString(),
            ],
        ]);
    }

    protected function resolveMessageableFromRoute(Request $request, array $validated): array
    {
        $uri = Route::current()->uri();

        if (str_contains($uri, 'post')) {
            $postId = $validated['post_id'] ?? $request->route('id');
            return [Post::findOrFail($postId), 'comment'];
        }

        if (str_contains($uri, 'video')) {
            $videoId = $validated['video_id'] ?? $request->route('id');
            return [Video::findOrFail($videoId), 'comment'];
        }

        $chatId = $validated['chat_id'] ?? $request->route('id');
        return [Chat::findOrFail($chatId), 'chat'];
    }

    protected function resolveCommentableTarget(Request $request, array $validated)
    {
        $uri = Route::current()->uri();

        if (str_contains($uri, 'post')) {
            return Post::findOrFail($validated['post_id'] ?? null);
        }

        if (str_contains($uri, 'video')) {
            return Video::findOrFail($validated['video_id'] ?? null);
        }

        return Chat::findOrFail($validated['chat_id'] ?? null);
    }

    protected function canManageCommentable($user, $target): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->role === 'admin') {
            return true;
        }

        if ($target instanceof Chat) {
            return (int) $target->owner_id === (int) $user->id;
        }

        return (int) $target->author_id === (int) $user->id;
    }

    protected function canManageMessage($user, Message $message): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->role === 'admin' || (int) $message->author_id === (int) $user->id) {
            return true;
        }

        $owner = $message->messageable;

        if ($owner instanceof Chat) {
            return (int) $owner->owner_id === (int) $user->id;
        }

        if ($owner instanceof Post || $owner instanceof Video) {
            return (int) $owner->author_id === (int) $user->id;
        }

        return false;
    }

    protected function isChatMember(int $userId, Chat $chat): bool
    {
        if ($chat->relationLoaded('members')) {
            return $chat->members->contains('id', $userId);
        }

        return $chat->members()->where('users.id', $userId)->exists();
    }

    protected function decorateMessagesForViewer($messages, $viewer, Chat $chat): Collection
    {
        $participantIds = $this->getChatParticipantIds($chat);

        return $messages->map(function (Message $message) use ($viewer, $participantIds) {
            return $this->decorateMessageForViewer($message, $viewer, $participantIds);
        });
    }

    protected function decorateMessageForViewer(Message $message, $viewer, Collection $participantIds): Message
    {
        $readByIds = $message->relationLoaded('readers')
            ? $message->readers->pluck('id')->map(fn($id) => (int) $id)->unique()->values()
            : collect();

        $message->setAttribute('read_by_user_ids', $readByIds->all());
        $message->setAttribute('read_by_count', $readByIds->count());
        $message->setAttribute('is_read_by_current_user', $readByIds->contains((int) $viewer->id));

        if ((int) $message->author_id === (int) $viewer->id) {
            $recipientIds = $participantIds
                ->filter(fn($id) => (int) $id !== (int) $viewer->id)
                ->values();

            $allRecipientsRead = $recipientIds->isNotEmpty()
                && $recipientIds->diff($readByIds)->isEmpty();

            $message->setAttribute('status_for_current_user', $allRecipientsRead ? 'read' : 'sent');
        } else {
            $message->setAttribute('status_for_current_user', null);
        }

        return $message;
    }

    protected function getChatParticipantIds(Chat $chat): Collection
    {
        if ($chat->relationLoaded('members')) {
            return $chat->members->pluck('id')->map(fn($id) => (int) $id)->values();
        }

        return $chat->members()->pluck('users.id')->map(fn($id) => (int) $id)->values();
    }

    protected function isPersonalChatInteractionBlocked(Chat $chat, int $currentUserId): bool
    {
        if ($chat->type !== 'personal') {
            return false;
        }

        $participantIds = $this->getChatParticipantIds($chat);
        $otherUserId = $participantIds->first(fn($id) => (int) $id !== $currentUserId);

        if (!$otherUserId) {
            return false;
        }

        return $this->isUserBlockedPair($currentUserId, (int) $otherUserId);
    }

    protected function isUserBlockedPair(int $firstUserId, int $secondUserId): bool
    {
        return UserBlock::query()
            ->where(function ($query) use ($firstUserId, $secondUserId) {
                $query->where('blocker_id', $firstUserId)
                    ->where('blocked_id', $secondUserId);
            })
            ->orWhere(function ($query) use ($firstUserId, $secondUserId) {
                $query->where('blocker_id', $secondUserId)
                    ->where('blocked_id', $firstUserId);
            })
            ->exists();
    }
}
