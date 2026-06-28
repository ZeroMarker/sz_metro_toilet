import requests
import time
from browser_use import Browser

def download_images(urls, prefix):
    for i, url in enumerate(urls):
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                filename = f"{prefix}_{i+1}.png"
                with open(filename, 'wb') as f:
                    f.write(response.content)
                print(f"Downloaded {filename}")
        except Exception as e:
            print(f"Error downloading {url}: {e}")

async def main():
    browser = Browser()
    await browser.start()
    
    lines = [
        (21, '6号线'),
        (22, '6号线支线'),
        (23, '7号线'),
        (24, '9号线'),
        (25, '10号线'),
        (26, '11号线'),
        (27, '12号线'),
        (39, '13号线'),
        (40, '14号线'),
        (41, '16号线'),
        (42, '20号线'),
    ]
    
    for line_index, line_name in lines:
        print(f"Downloading {line_name}...")
        await browser.goto("https://szmc-intweb.shenzhenmc.com/jimu/10049/#/")
        time.sleep(3)
        
        # Click the line tab
        await browser.evaluate(f"""
            document.querySelectorAll('[data-v-2db72eed] > span > div')[{line_index}].click();
        """)
        time.sleep(2)
        
        # Get image URLs
        images = await browser.evaluate("""
            Array.from(document.querySelectorAll('.long-image-card-container img')).map(img => img.src)
        """)
        
        download_images(images, f"line_{line_name.replace('/', '_')}")
    
    await browser.stop()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
