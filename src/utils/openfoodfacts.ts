export interface ProductInfo {
  name: string | null;
  imageUrl: string | null;
}

export async function fetchProductByEAN(ean: string): Promise<ProductInfo | null> {
  try {
    const response = await fetch(
      `https://fr.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=product_name,image_front_url,image_front_small_url`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;
    return {
      name: data.product.product_name || null,
      imageUrl: data.product.image_front_url || data.product.image_front_small_url || null,
    };
  } catch (error) {
    console.error('Error fetching product from Open Food Facts:', error);
    return null;
  }
}
