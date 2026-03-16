<?php

namespace App\Http\Controllers;

use App\Models\FriendRequest;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FriendController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $friends = FriendRequest::query()
            ->accepted()
            ->where(function ($query) use ($user) {
                $query->where('sender_id', $user->id)
                    ->orWhere('receiver_id', $user->id);
            })
            ->with(['sender:id,name,avatar', 'receiver:id,name,avatar'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (FriendRequest $friendRequest) => $this->formatRequestCounterparty($friendRequest, $user->id, 'friends'))
            ->values();

        $incomingRequests = FriendRequest::query()
            ->pending()
            ->where('receiver_id', $user->id)
            ->with(['sender:id,name,avatar'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function (FriendRequest $friendRequest) {
                return [
                    ...$this->formatUserCard($friendRequest->sender),
                    'relation' => 'incoming_request',
                    'requested_at' => optional($friendRequest->created_at)->toISOString(),
                ];
            })
            ->values();

        $outgoingRequests = FriendRequest::query()
            ->pending()
            ->where('sender_id', $user->id)
            ->with(['receiver:id,name,avatar'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function (FriendRequest $friendRequest) {
                return [
                    ...$this->formatUserCard($friendRequest->receiver),
                    'relation' => 'outgoing_request',
                    'requested_at' => optional($friendRequest->created_at)->toISOString(),
                ];
            })
            ->values();

        $blockedUsers = UserBlock::query()
            ->where('blocker_id', $user->id)
            ->with(['blocked:id,name,avatar'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function (UserBlock $block) {
                return [
                    ...$this->formatUserCard($block->blocked),
                    'relation' => 'blocked_by_me',
                    'blocked_at' => optional($block->created_at)->toISOString(),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'friends' => $friends,
                'incoming_requests' => $incomingRequests,
                'outgoing_requests' => $outgoingRequests,
                'blocked_users' => $blockedUsers,
                'counts' => [
                    'friends' => $friends->count(),
                    'incoming_requests' => $incomingRequests->count(),
                    'outgoing_requests' => $outgoingRequests->count(),
                    'blocked_users' => $blockedUsers->count(),
                ],
            ],
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        $friendsCount = FriendRequest::query()
            ->accepted()
            ->where(function ($query) use ($user) {
                $query->where('sender_id', $user->id)
                    ->orWhere('receiver_id', $user->id);
            })
            ->count();

        $incomingRequestsCount = FriendRequest::query()
            ->pending()
            ->where('receiver_id', $user->id)
            ->count();

        $outgoingRequestsCount = FriendRequest::query()
            ->pending()
            ->where('sender_id', $user->id)
            ->count();

        $blockedUsersCount = UserBlock::query()
            ->where('blocker_id', $user->id)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'friends' => $friendsCount,
                'incoming_requests' => $incomingRequestsCount,
                'outgoing_requests' => $outgoingRequestsCount,
                'blocked_users' => $blockedUsersCount,
            ],
        ]);
    }

    public function relation(Request $request, $id): JsonResponse
    {
        $viewer = $request->user();
        $otherUser = User::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    public function sendRequest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $viewer = $request->user();
        $otherUser = User::findOrFail($validated['user_id']);

        if ((int) $viewer->id === (int) $otherUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя отправить заявку в друзья самому себе.',
            ], 422);
        }

        $blockState = $this->getBlockState((int) $viewer->id, (int) $otherUser->id);
        if ($blockState === 'blocked_by_me') {
            return response()->json([
                'success' => false,
                'message' => 'Сначала разблокируйте пользователя, чтобы отправить заявку.',
            ], 409);
        }

        if ($blockState === 'blocked_me') {
            return response()->json([
                'success' => false,
                'message' => 'Пользователь заблокировал вас. Отправить заявку нельзя.',
            ], 403);
        }

        $acceptedRequest = $this->friendRequestsBetween((int) $viewer->id, (int) $otherUser->id)
            ->accepted()
            ->first();

        if ($acceptedRequest) {
            return response()->json([
                'success' => true,
                'message' => 'Вы уже в друзьях.',
                'data' => $this->buildRelationData($viewer, $otherUser),
            ]);
        }

        $incomingRequest = FriendRequest::query()
            ->pending()
            ->where('sender_id', $otherUser->id)
            ->where('receiver_id', $viewer->id)
            ->first();

        if ($incomingRequest) {
            $incomingRequest->update([
                'status' => FriendRequest::STATUS_ACCEPTED,
                'responded_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Заявка найдена и автоматически принята.',
                'auto_accepted' => true,
                'data' => $this->buildRelationData($viewer, $otherUser),
            ]);
        }

        $outgoingRequest = FriendRequest::query()
            ->pending()
            ->where('sender_id', $viewer->id)
            ->where('receiver_id', $otherUser->id)
            ->first();

        if ($outgoingRequest) {
            return response()->json([
                'success' => true,
                'message' => 'Заявка уже отправлена.',
                'data' => $this->buildRelationData($viewer, $otherUser),
            ]);
        }

        FriendRequest::create([
            'sender_id' => $viewer->id,
            'receiver_id' => $otherUser->id,
            'status' => FriendRequest::STATUS_PENDING,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Заявка в друзья отправлена.',
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    public function accept(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $viewer = $request->user();
        $otherUser = User::findOrFail($validated['user_id']);

        $friendRequest = FriendRequest::query()
            ->pending()
            ->where('sender_id', $otherUser->id)
            ->where('receiver_id', $viewer->id)
            ->first();

        if (!$friendRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Входящая заявка не найдена.',
            ], 404);
        }

        $friendRequest->update([
            'status' => FriendRequest::STATUS_ACCEPTED,
            'responded_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Заявка принята.',
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    public function decline(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $viewer = $request->user();
        $otherUser = User::findOrFail($validated['user_id']);

        $friendRequest = FriendRequest::query()
            ->pending()
            ->where('sender_id', $otherUser->id)
            ->where('receiver_id', $viewer->id)
            ->first();

        if (!$friendRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Входящая заявка не найдена.',
            ], 404);
        }

        $friendRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Заявка отклонена.',
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    public function cancel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $viewer = $request->user();
        $otherUser = User::findOrFail($validated['user_id']);

        $friendRequest = FriendRequest::query()
            ->pending()
            ->where('sender_id', $viewer->id)
            ->where('receiver_id', $otherUser->id)
            ->first();

        if (!$friendRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Исходящая заявка не найдена.',
            ], 404);
        }

        $friendRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Заявка отозвана.',
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    public function remove(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $viewer = $request->user();
        $otherUser = User::findOrFail($validated['user_id']);

        $friendRequest = $this->friendRequestsBetween((int) $viewer->id, (int) $otherUser->id)
            ->accepted()
            ->first();

        if (!$friendRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Пользователь не найден в списке друзей.',
            ], 404);
        }

        $friendRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Пользователь удалён из друзей.',
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    public function block(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $viewer = $request->user();
        $otherUser = User::findOrFail($validated['user_id']);

        if ((int) $viewer->id === (int) $otherUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя заблокировать самого себя.',
            ], 422);
        }

        UserBlock::query()->updateOrCreate([
            'blocker_id' => $viewer->id,
            'blocked_id' => $otherUser->id,
        ]);

        $this->friendRequestsBetween((int) $viewer->id, (int) $otherUser->id)->delete();

        return response()->json([
            'success' => true,
            'message' => 'Пользователь заблокирован.',
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    public function unblock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $viewer = $request->user();
        $otherUser = User::findOrFail($validated['user_id']);

        UserBlock::query()
            ->where('blocker_id', $viewer->id)
            ->where('blocked_id', $otherUser->id)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Пользователь разблокирован.',
            'data' => $this->buildRelationData($viewer, $otherUser),
        ]);
    }

    protected function buildRelationData(User $viewer, User $otherUser): array
    {
        $relation = $this->resolveRelation((int) $viewer->id, (int) $otherUser->id);

        return [
            'relation' => $relation,
            'other_user' => $this->formatUserCard($otherUser),
            'can_message' => !in_array($relation, ['self', 'blocked_by_me', 'blocked_me'], true),
            'can_send_request' => $relation === 'none',
            'can_accept_request' => $relation === 'incoming_request',
            'can_decline_request' => $relation === 'incoming_request',
            'can_cancel_request' => $relation === 'outgoing_request',
            'can_remove_friend' => $relation === 'friends',
            'can_block' => !in_array($relation, ['self', 'blocked_by_me'], true),
            'can_unblock' => $relation === 'blocked_by_me',
        ];
    }

    protected function resolveRelation(int $viewerId, int $otherUserId): string
    {
        if ($viewerId === $otherUserId) {
            return 'self';
        }

        $blockState = $this->getBlockState($viewerId, $otherUserId);
        if ($blockState !== null) {
            return $blockState;
        }

        $acceptedRequest = $this->friendRequestsBetween($viewerId, $otherUserId)
            ->accepted()
            ->exists();

        if ($acceptedRequest) {
            return 'friends';
        }

        $outgoingRequest = FriendRequest::query()
            ->pending()
            ->where('sender_id', $viewerId)
            ->where('receiver_id', $otherUserId)
            ->exists();

        if ($outgoingRequest) {
            return 'outgoing_request';
        }

        $incomingRequest = FriendRequest::query()
            ->pending()
            ->where('sender_id', $otherUserId)
            ->where('receiver_id', $viewerId)
            ->exists();

        if ($incomingRequest) {
            return 'incoming_request';
        }

        return 'none';
    }

    protected function getBlockState(int $viewerId, int $otherUserId): ?string
    {
        $blockedByViewer = UserBlock::query()
            ->where('blocker_id', $viewerId)
            ->where('blocked_id', $otherUserId)
            ->exists();

        if ($blockedByViewer) {
            return 'blocked_by_me';
        }

        $blockedByOtherUser = UserBlock::query()
            ->where('blocker_id', $otherUserId)
            ->where('blocked_id', $viewerId)
            ->exists();

        if ($blockedByOtherUser) {
            return 'blocked_me';
        }

        return null;
    }

    protected function friendRequestsBetween(int $firstUserId, int $secondUserId)
    {
        return FriendRequest::query()->where(function ($outerQuery) use ($firstUserId, $secondUserId) {
            $outerQuery->where(function ($query) use ($firstUserId, $secondUserId) {
                $query->where('sender_id', $firstUserId)
                    ->where('receiver_id', $secondUserId);
            })->orWhere(function ($query) use ($firstUserId, $secondUserId) {
                $query->where('sender_id', $secondUserId)
                    ->where('receiver_id', $firstUserId);
            });
        });
    }

    protected function formatRequestCounterparty(FriendRequest $friendRequest, int $currentUserId, string $relation): array
    {
        $otherUser = (int) $friendRequest->sender_id === $currentUserId
            ? $friendRequest->receiver
            : $friendRequest->sender;

        return [
            ...$this->formatUserCard($otherUser),
            'relation' => $relation,
            'requested_at' => optional($friendRequest->created_at)->toISOString(),
            'responded_at' => optional($friendRequest->responded_at)->toISOString(),
        ];
    }

    protected function formatUserCard(?User $user): array
    {
        return [
            'id' => $user?->id,
            'name' => $user?->name,
            'avatar' => $user?->avatar,
        ];
    }
}
