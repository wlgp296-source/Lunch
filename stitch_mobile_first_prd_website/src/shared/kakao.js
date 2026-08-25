const kakaoJavaScriptKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || '';

function getKakao() {
  if (!kakaoJavaScriptKey || !window.Kakao) return null;

  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(kakaoJavaScriptKey);
  }

  return window.Kakao;
}

export async function shareInviteToKakao({ title, description, url }) {
  const kakao = getKakao();

  if (kakao?.Share) {
    kakao.Share.sendDefault({
      objectType: 'text',
      text: `${title}\n${description}\n${url}`,
      link: {
        mobileWebUrl: url,
        webUrl: url,
      },
    });
    return 'kakao';
  }

  if (navigator.share) {
    await navigator.share({ title, text: description, url });
    return 'system';
  }

  await navigator.clipboard.writeText(url);
  return 'clipboard';
}
