export function fakeOpencode(messages: any[] = []) {
  const toasts: any[] = []
  const permissionReplies: any[] = []
  const client = {
    tui: {
      showToast: async (opts: any) => {
        toasts.push(opts.body)
        return true
      },
    },
    session: { messages: async () => ({ data: messages }) },
    postSessionIdPermissionsPermissionId: async (opts: any) => {
      permissionReplies.push(opts)
      return { data: true }
    },
  }
  return { client, toasts, permissionReplies, messages }
}
