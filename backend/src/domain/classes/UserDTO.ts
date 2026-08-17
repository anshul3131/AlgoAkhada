export class UserSearchItemDTO {
    id: string;
    username: string;
    eloRating: number;
}

export class UserSearchResponseDTO {
    users: UserSearchItemDTO[];
}
