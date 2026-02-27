export interface Chat {
    id: number
    name: string
    messages: Messages[]
    //creator_id: number
}

/*
export interface Member{
chat_id:number
user_id: number
role: string
}
*/

export interface Messages {
    id: number
    mess: string
    timestamp: string
    sender_id: number | null
    char_id: number | null
}

// status: Boolean
// create another table

export const chats: Chat[] = [
    {
        id: 1,
        name: 'lumina friend1',
        messages: [{
            id: 0,
            mess: "lumina friend1lumina friend1lumina friend1lumina friend1",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }, {
            id: 1,
            mess: "lumina friend1lumina friend1lumina friend1",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }],
    }, {
        id: 2,
        name: 'lumina friend2',
        messages: [{
            id: 0,
            mess: "lumina friend2lumina friend2",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }, {
            id: 1,
            mess: "lorem ipsum",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }],
    }, {
        id: 3,
        name: 'lumina friend3',
        messages: [{
            id: 0,
            mess: "lumina friend3lumina friend3",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }, {
            id: 1,
            mess: "lorem ipsum",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }],
    }, {
        id: 4,
        name: 'lumina friend4',
        messages: [{
            id: 0,
            mess: "lumina friend4lumina friend4",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }, {
            id: 1,
            mess: "lumina friend4lumina friend4",
            timestamp: '12.12',
            sender_id: 1,
            char_id: 1,
        }],
    }
]