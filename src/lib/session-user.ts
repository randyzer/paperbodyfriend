type SessionUserLike = {
  displayName: string | null;
  email: string;
};

export function getSessionUserLabel(user: SessionUserLike) {
  const trimmedDisplayName = user.displayName?.trim();
  return trimmedDisplayName && trimmedDisplayName.length > 0
    ? trimmedDisplayName
    : user.email;
}

export function getSessionUserAvatarInitial(user: SessionUserLike) {
  const label = getSessionUserLabel(user).trim();

  if (!label) {
    return 'U';
  }

  return label.charAt(0).toUpperCase();
}
